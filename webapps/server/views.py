#    Copyright 2013 10gen Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.

import logging
from datetime import datetime, timedelta
from functools import update_wrapper
import uuid

from bson import BSON
from bson.json_util import dumps, loads
from flask import Blueprint, current_app, make_response, request, session
app = current_app
from pymongo.errors import (InvalidDocument, OperationFailure,
    InvalidId, DuplicateKeyError)

from webapps.lib import CLIENTS_COLLECTION
from webapps.lib.MWSServerError import MWSServerError
from webapps.lib.db import get_db
from webapps.lib.decorators import check_session_id, ratelimit
from webapps.lib.util import (
    UseResId,
    get_collection_names,
    get_internal_coll_name
)

mws = Blueprint('mws', __name__, url_prefix='/mws')

@mws.after_request
def no_cache(response):
    response.cache_control.no_cache = True
    response.headers['Expires'] = 0
    return response


def validate_document(document):
    if not isinstance(document, dict):
        raise MWSServerError(400,
            u"Could not validate '{0}', expected a document".format(document))
    try:
        BSON.encode(document)
    except (InvalidDocument, TypeError, InvalidId) as e:
        raise MWSServerError(400, str(e))

def calculate_document_size(document):
    return len(BSON.encode(document))

@mws.route('/', methods=['POST', 'OPTIONS'])
def create_mws_resource():
    session_id = session.get('session_id', str(uuid.uuid4()))
    session['session_id'] = session_id
    clients = get_db()[CLIENTS_COLLECTION]

    cursor = clients.find({'session_id': session_id}, {'res_id': 1, '_id': 0})
    if cursor.count():
        # TODO: handle multiple res_id per session
        res_id = cursor[0]['res_id']
        is_new = False
    else:
        res_id = generate_res_id()
        clients.insert({
            'version': 1,
            'res_id': res_id,
            'collections': [],
            'session_id': session_id,
            'timestamp': datetime.now()
        })
        is_new = True
    return to_json({'res_id': res_id, 'is_new': is_new})


@mws.route('/<res_id>/keep-alive', methods=['POST', 'OPTIONS'])
@check_session_id
def keep_mws_alive(res_id):
    clients = get_db()[CLIENTS_COLLECTION]
    clients.update({'session_id': session.get('session_id'), 'res_id': res_id},
                   {'$set': {'timestamp': datetime.now()}})
    return empty_success()


@mws.route('/<res_id>/db/<collection_name>/find', methods=['GET', 'OPTIONS'])
@check_session_id
@ratelimit
def db_collection_find(res_id, collection_name):
    # TODO: Should we specify a content type? Then we have to use an options
    # header, and we should probably get the return type from the content-type
    # header.
    try:
        parse_get_json(request)
    except (InvalidId, TypeError) as e:
        raise MWSServerError(400, str(e))
    query = request.json.get('query')
    projection = request.json.get('projection')
    skip = request.json.get('skip', 0)
    limit = request.json.get('limit', 0)
    sort = request.json.get('sort', {})
    sort = sort.items()

    with UseResId(res_id):
        coll = get_db()[collection_name]
        try:
            cursor = coll.find(query, projection, skip, limit)
            if len(sort) > 0:
                cursor.sort(sort)
            documents = list(cursor)
        except (InvalidId, TypeError, OperationFailure) as e:
            raise MWSServerError(400, str(e))
        return to_json({'result': documents})


@mws.route('/<res_id>/db/<collection_name>/insert',
           methods=['POST', 'OPTIONS'])
@check_session_id
@ratelimit
def db_collection_insert(res_id, collection_name):
    # TODO: Ensure request.json is not None.
    try:
        request.json = loads(request.data)
    except (InvalidId, TypeError) as e:
        raise MWSServerError(400, str(e))
    if 'document' in request.json:
        document = request.json['document']
    else:
        error = '\'document\' argument not found in the insert request.'
        raise MWSServerError(400, error)

    # Check quota
    size = get_collection_size(res_id, collection_name)

    # Handle inserting both a list of docs or a single doc
    if isinstance(document, list):
        req_size = 0
        for d in document:
            validate_document(d)
            req_size += calculate_document_size(d)
    else:
        validate_document(document)
        req_size = calculate_document_size(document)

    if size + req_size > current_app.config['QUOTA_COLLECTION_SIZE']:
        raise MWSServerError(403, 'Collection size exceeded')

    # Insert document
    with UseResId(res_id):
        try:
            get_db()[collection_name].insert(document)
            return empty_success()
        except (DuplicateKeyError, InvalidDocument, InvalidId, TypeError) as e:
            raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/<collection_name>/remove',
           methods=['DELETE', 'OPTIONS'])
@check_session_id
@ratelimit
def db_collection_remove(res_id, collection_name):
    try:
        request.json = loads(request.data)
    except (InvalidId, TypeError) as e:
        raise MWSServerError(400, str(e))
    constraint = request.json.get('constraint') if request.json else {}
    just_one = request.json and request.json.get('just_one', False)

    with UseResId(res_id):
        collection = get_db()[collection_name]
        try:
            if just_one:
                collection.find_and_modify(constraint, remove=True)
            else:
                collection.remove(constraint)
        except (InvalidDocument, InvalidId, TypeError, OperationFailure) as e:
            raise MWSServerError(400, str(e))
        return empty_success()


@mws.route('/<res_id>/db/<collection_name>/update', methods=['PUT', 'OPTIONS'])
@check_session_id
@ratelimit
def db_collection_update(res_id, collection_name):
    query = update = None
    if request.json:
        query = request.json.get('query')
        update = request.json.get('update')
        upsert = request.json.get('upsert', False)
        multi = request.json.get('multi', False)
    if query is None or update is None:
        error = 'update requires spec and document arguments'
        raise MWSServerError(400, error)

    # Check quota
    size = get_collection_size(res_id, collection_name)

    with UseResId(res_id):
        # Computation of worst case size increase - update size * docs affected
        # It would be nice if we were able to make a more conservative estimate
        # of the space difference that an update will cause. (especially if it
        # results in smaller documents)
        db = get_db()
        affected = db[collection_name].find(query).count()
        req_size = len(BSON.encode(update)) * affected

        if size + req_size > current_app.config['QUOTA_COLLECTION_SIZE']:
            raise MWSServerError(403, 'Collection size exceeded')

        try:
            db[collection_name].update(query, update, upsert, multi=multi)
            return empty_success()
        except (DuplicateKeyError,
            InvalidDocument,
            InvalidId,
            TypeError,
            OperationFailure) as e:
            raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/<collection_name>/save',
           methods=['POST', 'OPTIONS'])
@check_session_id
@ratelimit
def db_collection_save(res_id, collection_name):
    # TODO: Ensure request.json is not None.
    try:
        request.json = loads(request.data)
    except (InvalidId, TypeError) as e:
        raise MWSServerError(400, str(e))
    if 'document' in request.json:
        document = request.json['document']
    else:
        error = '\'document\' argument not found in the save request.'
        raise MWSServerError(400, error)

    # Check quota
    size = get_collection_size(res_id, collection_name)

    validate_document(document)
    req_size = calculate_document_size(document)

    if size + req_size > current_app.config['QUOTA_COLLECTION_SIZE']:
        raise MWSServerError(403, 'Collection size exceeded')

    # Save document
    with UseResId(res_id):
        try:
            get_db()[collection_name].save(document)
            return empty_success()
        except (InvalidId, TypeError, InvalidDocument, DuplicateKeyError) as e:
            raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/<collection_name>/aggregate',
           methods=['GET', 'OPTIONS'])
@check_session_id
def db_collection_aggregate(res_id, collection_name):
    parse_get_json(request)
    try:
        with UseResId(res_id):
            coll = get_db()[collection_name]
            try:
                result = coll.aggregate(request.json)
                return to_json(result)
            except (InvalidId, TypeError, InvalidDocument) as e:
                raise MWSServerError(400, str(e))
    except OperationFailure as e:
        raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/<collection_name>/drop',
           methods=['DELETE', 'OPTIONS'])
@check_session_id
@ratelimit
def db_collection_drop(res_id, collection_name):
    with UseResId(res_id):
        get_db().drop_collection(collection_name)
    return empty_success()


@mws.route('/<res_id>/db/<collection_name>/count', methods=['GET', 'OPTIONS'])
@check_session_id
@ratelimit
def db_collection_count(res_id, collection_name):
    try:
        parse_get_json(request)
    except (InvalidId, TypeError) as e:
        raise MWSServerError(400, str(e))

    query = request.json.get('query')
    skip = request.json.get('skip', 0)
    limit = request.json.get('limit', 0)
    use_skip_limit = bool(skip or limit)

    with UseResId(res_id):
        coll = get_db()[collection_name]
        try:
            cursor = coll.find(query, skip=skip, limit=limit)
            count = cursor.count(use_skip_limit)
            return to_json({'count': count})
        except InvalidDocument as e:
            raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/getCollectionNames',
           methods=['GET', 'OPTIONS'])
@check_session_id
def db_get_collection_names(res_id):
    return to_json({'result': get_collection_names(res_id)})


@mws.route('/<res_id>/db',
           methods=['DELETE', 'OPTIONS'])
@check_session_id
def db_drop(res_id):
    DB = get_db()
    collections = get_collection_names(res_id)
    with UseResId(res_id):
        for c in collections:
            DB.drop_collection(c)
        return empty_success()


def generate_res_id():
    return str(uuid.uuid4())


def user_has_access(res_id, session_id):
    query = {'res_id': res_id, 'session_id': session_id}
    coll = get_db()[CLIENTS_COLLECTION]
    return_value = coll.find_one(query)
    return False if return_value is None else True


def to_json(result):
    try:
        return dumps(result), 200
    except ValueError:
        error = 'Error in find while trying to convert the results to ' + \
                'JSON format.'
        raise MWSServerError(500, error)


def empty_success():
    return '', 204


def parse_get_json(request):
    try:
        request.json = loads(request.args.keys()[0])
    except ValueError:
        raise MWSServerError(400, 'Error parsing JSON data',
                             'Invalid GET parameter data')


def get_collection_size(res_id, collection_name):
    coll = get_internal_coll_name(res_id, collection_name)
    try:
        return get_db().command({'collstats': coll})['size']
    except OperationFailure as e:
        if 'ns not found' in str(e):
            return 0
        else:
            raise MWSServerError(500, str(e))
