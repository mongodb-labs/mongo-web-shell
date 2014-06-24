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
    get_collection_names
)

_logger = logging.getLogger(__name__)

mws = Blueprint('mws', __name__, url_prefix='/mws')

pretty_insert = 'WriteResult({{ "nInserted" : {0} }})'
pretty_bulk_insert = """BulkWriteResult({{
    "writeErrors" : [ ],
    "writeConcernErrors" : [ ],
    "nInserted" : {0},
    "nUpserted" : 0,
    "nMatched" : 0,
    "nModified" : 0,
    "nRemoved" : 0,
    "upserted" : [ ]
}})"""
pretty_update = 'WriteResult({{ "nMatched" : {0}, "nUpserted" : 0, "nModified" : {1} }})'
pretty_upsert = 'WriteResult({{ "nMatched" : {0}, "nUpserted" : {1}, "nModified" : {2}, "_id": {3} }})'
pretty_remove = 'WriteResult({{ "nRemoved" : {0} }})'



def generate_res_id():
    return str(uuid.uuid4())


def empty_success():
    return '', 204


def parse_get_json():
    try:
        request_data = request.data or request.args['data']
        if request_data:
            request.json = loads(request_data)
        else:
            request.json = {}
    except (InvalidId, TypeError, ValueError) as e:
        raise MWSServerError(400, str(e))


def to_json(result):
    try:
        return dumps(result), 200
    except ValueError:
        error = 'Error in find while trying to convert the results to ' + \
                'JSON format.'
        raise MWSServerError(500, error)


@mws.after_request
def no_cache(response):
    response.cache_control.no_cache = True
    response.headers['Expires'] = 0
    return response


def validate_document_or_list(document):
    if isinstance(document, list):
        for d in document:
            validate_document(d)
    else:
        validate_document(document)


def validate_document(document):
    if not isinstance(document, dict):
        raise MWSServerError(400,
            u"Could not validate '{0}', expected a document".format(document))
    try:
        BSON.encode(document)
    except (InvalidDocument,
        TypeError,
        InvalidId,
        BSONError,
        InvalidBSON,
        InvalidStringData
        ) as e:
        raise MWSServerError(400, str(e))


def calculate_document_size(document):
    req_size = 0
    if isinstance(document, list):
        for d in document:
            req_size += calculate_document_size(d)
    else:
        req_size = len(BSON.encode(document))
    return req_size


@mws.route('/', methods=['POST'])
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


@mws.route('/<res_id>/keep-alive', methods=['POST'])
@check_session_id
def keep_mws_alive(res_id):
    clients = get_db()[CLIENTS_COLLECTION]
    clients.update({'session_id': session.get('session_id'), 'res_id': res_id},
                   {'$set': {'timestamp': datetime.now()}})
    return empty_success()


# Read Methods

@mws.route('/<res_id>/db/<collection_name>/find', methods=['GET'])
@check_session_id
@ratelimit
def db_collection_find(res_id, collection_name):
    parse_get_json()
    query = request.json.get('query')
    projection = request.json.get('projection')
    skip = request.json.get('skip', 0)
    limit = request.json.get('limit', 0)
    sort = request.json.get('sort', {})
    sort = sort.items()

    with UseResId(res_id) as db:
        coll = db[collection_name]
        try:
            cursor = coll.find(query, projection, skip, limit)
            if len(sort) > 0:
                cursor.sort(sort)
            documents = list(cursor)
        except (InvalidId, TypeError, OperationFailure) as e:
            raise MWSServerError(400, str(e))
        return to_json({'result': documents})


@mws.route('/<res_id>/db/<collection_name>/count', methods=['GET'])
@check_session_id
@ratelimit
def db_collection_count(res_id, collection_name):
    parse_get_json()

    query = request.json.get('query')

    with UseResId(res_id) as db:
        coll = db[collection_name]
        try:
            count = coll.find(query).count()
            return to_json({'count': count})
        except InvalidDocument as e:
            raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/<collection_name>/aggregate', methods=['GET'])
@check_session_id
def db_collection_aggregate(res_id, collection_name):
    parse_get_json()
    with UseResId(res_id) as db:
        try:
            result = db[collection_name].aggregate(request.json)
        except (InvalidId,
            TypeError,
            InvalidDocument,
            OperationFailure) as e:
            raise MWSServerError(400, str(e))
    return to_json(result)

# Write Methods


@mws.route('/<res_id>/db/<collection_name>/insert', methods=['POST'])
@check_session_id
@ratelimit
def db_collection_insert(res_id, collection_name):
    parse_get_json()

    document = request.json.get('document')
    if document is None:
        raise MWSServerError(400,
            "no object passed to insert!")

    validate_document_or_list(document)
    req_size = calculate_document_size(document)

    # Insert document
    with UseResId(res_id) as db:
        # Check quota
        size = db[collection_name].size()
        if size + req_size > current_app.config['QUOTA_COLLECTION_SIZE']:
            raise MWSServerError(403, 'Collection size exceeded')

        # Attempt Insert
        try:
            res = db[collection_name].insert(document)
        except (DuplicateKeyError, OperationFailure) as e:
            raise MWSServerError(400, str(e))
        if isinstance(res, list):
            pretty_response = pretty_bulk_insert.format(len(res))
        else:
            pretty_response = pretty_insert.format(1)
    return to_json({'pretty': pretty_response})


@mws.route('/<res_id>/db/<collection_name>/update', methods=['PUT'])
@check_session_id
@ratelimit
def db_collection_update(res_id, collection_name):
    parse_get_json()

    query = request.json.get('query')
    update = request.json.get('update')
    upsert = request.json.get('upsert', False)
    multi = request.json.get('multi', False)
    if query is None or update is None:
        error = 'update requires spec and document arguments'
        raise MWSServerError(400, error)


    with UseResId(res_id) as db:
        # Check quota
        coll = db[collection_name]
        # Computation of worst case size increase - update size * docs affected
        # It would be nice if we were able to make a more conservative estimate
        # of the space difference that an update will cause. (especially if it
        # results in smaller documents)
        # TODO: Make this more intelligent. I'm not sure that this even makes sense.
        affected = coll.find(query).count()
        req_size = calculate_document_size(update) * affected

        size = db[collection_name].size()

        if size + req_size > current_app.config['QUOTA_COLLECTION_SIZE']:
            raise MWSServerError(403, 'Collection size exceeded')

        # Attempt Update
        try:
            res = db[collection_name].update(query, update, upsert, multi=multi)
            _logger.info("res: {0}".format(res))
            n_matched = 0 if res.get('upserted') else res.get('n') 
            n_upserted = 1 if res.get('upserted') else 0
            n_modified = res.get('nModified', 0)
            if n_upserted:
                _id = res.get('upserted')[0].get('_id')
                pretty_response = pretty_upsert.format(n_matched, n_upserted, n_modified, _id)
            else:
                pretty_response = pretty_update.format(n_matched, n_modified)
            return to_json({'pretty': pretty_response})
        except (DuplicateKeyError,
            InvalidDocument,
            InvalidId,
            TypeError,
            OperationFailure) as e:
            raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/<collection_name>/save', methods=['POST'])
@check_session_id
@ratelimit
def db_collection_save(res_id, collection_name):
    parse_get_json()

    document = request.json.get('document')
    if document is None:
        raise MWSServerError(400,
            "'document' argument not found in the save request.")


    validate_document(document)
    req_size = calculate_document_size(document)


    # Get database
    with UseResId(res_id) as db:
        # Check quota
        size = db[collection_name].size()
        if size + req_size > current_app.config['QUOTA_COLLECTION_SIZE']:
            raise MWSServerError(403, 'Collection size exceeded')

        # Save document
        try:
            if "_id" not in document:
                res = db[collection_name].insert(document)
                if res:
                    res_len = len(res) if isinstance(res, list) else 1
                    pretty_response = pretty_insert.format(res_len)
            else:
                res = db[collection_name].update({"_id": document["_id"]},
                    document, True)
                n_matched = 0 if res.get('upserted') else 1
                n_upserted = 1 if res.get('upserted') else 0
                n_modified = res.get('nModified', 0)
                if n_upserted:
                    _id = res.get('upserted')[0].get('_id')
                    pretty_response = pretty_upsert.format(n_matched, n_upserted, n_modified, _id)
                else:
                    pretty_response = pretty_update.format(n_matched, n_modified)
            return to_json({'pretty': pretty_response})
        except (InvalidId, TypeError, InvalidDocument, DuplicateKeyError) as e:
            raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/<collection_name>/remove', methods=['DELETE'])
@check_session_id
@ratelimit
def db_collection_remove(res_id, collection_name):
    parse_get_json()
    constraint = request.json.get('constraint') if request.json else {}
    options = request.json and request.json.get('options', False)
    multi = not options.get('justOne')

    with UseResId(res_id) as db:
        collection = db[collection_name]
        try:
            res = collection.remove(constraint, multi=multi)
            pretty_response = pretty_remove.format(res.get('n'))
        except (InvalidDocument, InvalidId, TypeError, OperationFailure) as e:
            raise MWSServerError(400, str(e))
        return to_json({'pretty': pretty_response})


@mws.route('/<res_id>/db/<collection_name>/drop', methods=['DELETE'])
@check_session_id
@ratelimit
def db_collection_drop(res_id, collection_name):
    with UseResId(res_id) as db:
        db.drop_collection(collection_name)
    return empty_success()


@mws.route('/<res_id>/db', methods=['DELETE'])
@check_session_id
def db_drop(res_id):
    with UseResId(res_id) as db:
        db.drop_database()
        return empty_success()


@mws.route('/<res_id>/db/getCollectionNames', methods=['GET'])
@check_session_id
def db_get_collection_names(res_id):
    return to_json({'result': get_collection_names(res_id)})

