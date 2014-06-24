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
from pymongo.command_cursor import CommandCursor
from pymongo.errors import InvalidDocument, OperationFailure

from webapps.lib import CLIENTS_COLLECTION
from webapps.lib.MWSServerError import MWSServerError
from webapps.lib.db import get_db, get_keepalive_db
from webapps.lib.decorators import check_session_id, ratelimit
from webapps.lib.util import (
    UseResId,
    get_collection_names
)


mws = Blueprint('mws', __name__, url_prefix='/mws')


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

def create_cursor(collection, query=None, projection=None, sort=None, skip=0,
                  limit=0, batch_size=-1):
    # Need the below since mutable default values persist between calls
    if query is None:
        query = {}
    if sort is None:
        sort = {}

    print(collection)
    if batch_size == -1:
        cursor = collection.find(query=query, projection=projection, skip=skip,
                                 limit=limit)
    else:
        cursor = collection.find(query=query, projection=projection, skip=skip,
                                 limit=limit).batch_size(batch_size)

    if len(sort) > 0:
        cursor.sort(sort)
    return cursor


def recreate_cursor(collection, cursor_id, conn_id, retrieved, batch_size,
                    total_count):
    """
    Creates and returns a Cursor object based on an existing cursor in the
    in the server. If cursor_id is invalid, the returned cursor will raise
    OperationFailure on read. If batch_size is -1, then all remaining documents
    on the cursor are returned.
    """
    if cursor_id == 0:
        return None

    # since batch_size is not available when recreating a cursor, we have
    # to make some decisions so that limit represents both batch_size and
    # limit, and also accounts for pymongo subtracting retrieved from limit.
    if batch_size == -1:
        limit = (total_count - retrieved) + retrieved
    elif total_count - retrieved > batch_size:
        limit = batch_size + retrieved
    else:
        limit = (total_count - retrieved) + retrieved

    cursor_info = {'id': cursor_id, 'firstBatch': []}
    print("EHRIEOR")
    cursor = CommandCursor(collection, cursor_info, conn_id,
                           retrieved=retrieved)

    return cursor


def kill_cursor(collection, cursor_id):
    client = collection.db.db.connection
    client.kill_cursors([cursor_id])


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
    # TODO: Should we specify a content type? Then we have to use an options
    # header, and we should probably get the return type from the content-type
    # header.
    with UseResId(res_id, db=get_keepalive_db()) as db:
        parse_get_json()
        cursor_id = int(request.json.get('cursor_id', 0))
        limit = request.json.get('limit', 0)
        retrieved = request.json.get('retrieved', 0)
        drain_cursor = request.json.get('drain_cursor', False)
        batch_size = -1 if drain_cursor else current_app.config['CURSOR_BATCH_SIZE']
        count = request.json.get('count', 0)

        result = {}
        coll = db[collection_name]

        cursor = recreate_cursor(coll, cursor_id, 0, retrieved, batch_size, 
                                 count)
        if cursor is None:
            query = request.json.get('query')
            projection = request.json.get('projection')
            skip = request.json.get('skip', 0)
            sort = request.json.get('sort', {})
            sort = sort.items()
            cursor = create_cursor(
                coll, query=query,
                projection=projection,
                skip=skip, limit=limit,
                batch_size=batch_size)
            print(dir(cursor))
            print(cursor.count())
            # count is only available before cursor is read so we include it
            # in the first response
            result['count'] = cursor.count(with_limit_and_skip=True)
            count = result['count']

        if batch_size == -1:
            num_to_return = count - retrieved
        else:
            num_to_return = batch_size if limit > batch_size or limit == 0 else limit
        if num_to_return == 0:
            result['result'] = [x for x in cursor]
        else:
            try:
                result['result'] = []
                for i in range(num_to_return):
                    try:
                        result['result'].append(cursor.next())
                    except StopIteration:
                        break
            except OperationFailure as e:
                return MWSServerError(400, 'Cursor not found')

        # cursor_id is too big as a number, use a string instead
        result['cursor_id'] = str(cursor.cursor_id)
        # close the Cursor object, but keep the cursor alive on the server
        del cursor

        # kill cursor on server if all results are returned
        if count == retrieved + len(result['result']):
            kill_cursor(coll, long(result['cursor_id']))

        return to_json(result)


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
            print(collection_name)
            _id = db[collection_name].insert(document)
        except (DuplicateKeyError, OperationFailure) as e:
            raise MWSServerError(400, str(e))
    return to_json({'_id': _id})


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
            db[collection_name].update(query, update, upsert, multi=multi)
            return empty_success()
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
            db[collection_name].save(document)
            return empty_success()
        except (InvalidId, TypeError, InvalidDocument, DuplicateKeyError) as e:
            raise MWSServerError(400, str(e))


@mws.route('/<res_id>/db/<collection_name>/remove', methods=['DELETE'])
@check_session_id
@ratelimit
def db_collection_remove(res_id, collection_name):
    parse_get_json()
    constraint = request.json.get('constraint') if request.json else {}
    just_one = request.json and request.json.get('just_one', False)

    with UseResId(res_id) as db:
        collection = db[collection_name]
        try:
            if just_one:
                collection.find_and_modify(constraint, remove=True)
            else:
                collection.remove(constraint)
        except (InvalidDocument, InvalidId, TypeError, OperationFailure) as e:
            raise MWSServerError(400, str(e))
        return empty_success()


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
