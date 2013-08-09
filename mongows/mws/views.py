from datetime import datetime, timedelta
from functools import update_wrapper
import uuid

from bson import BSON
from bson.json_util import dumps, loads
from flask import Blueprint, current_app, make_response, request
from flask import session

from mongows.mws.MWSServerError import MWSServerError

from pymongo.errors import OperationFailure
from mongows.mws.db import get_db
from mongows.mws.util import (
    UseResId,
    get_collection_names,
    get_internal_coll_name
)

mws = Blueprint('mws', __name__, url_prefix='/mws')

CLIENTS_COLLECTION = 'clients'
REQUEST_ORIGIN = '*'  # TODO: Get this value from app config.


# TODO: Look over this method; remove unnecessary bits, check convention, etc.
# via http://flask.pocoo.org/snippets/56/
def crossdomain(origin=None, methods=None, headers=None,
                max_age=21600, attach_to_all=True,
                automatic_options=True):
    if methods is not None:
        methods = ', '.join(sorted(x.upper() for x in methods))
    if headers is not None and not isinstance(headers, basestring):
        headers = ', '.join(x.upper() for x in headers)
    if not isinstance(origin, basestring):
        origin = ', '.join(origin)
    if isinstance(max_age, timedelta):
        max_age = max_age.total_seconds()

    def get_methods():
        if methods is not None:
            return methods

        options_resp = current_app.make_default_options_response()
        return options_resp.headers['allow']

    def decorator(f):
        def wrapped_function(*args, **kwargs):
            if automatic_options and request.method == 'OPTIONS':
                resp = current_app.make_default_options_response()
            else:
                resp = make_response(f(*args, **kwargs))
            if not attach_to_all and request.method != 'OPTIONS':
                return resp

            h = resp.headers

            h['Access-Control-Allow-Origin'] = origin
            h['Access-Control-Allow-Methods'] = get_methods()
            h['Access-Control-Max-Age'] = str(max_age)
            if headers is not None:
                h['Access-Control-Allow-Headers'] = headers
            return resp

        f.provide_automatic_options = False
        return update_wrapper(wrapped_function, f)
    return decorator


def check_session_id(f):
    def wrapped_function(*args, **kwargs):
        session_id = session.get('session_id')
        if session_id is None:
            raise MWSServerError(401, 'There is no session_id cookie')
        if not user_has_access(kwargs['res_id'], session_id):
            error = 'Session error. User does not have access to res_id'
            raise MWSServerError(403, error)
        return f(*args, **kwargs)
    return update_wrapper(wrapped_function, f)


def ratelimit(f):
    def wrapped_function(*args, **kwargs):
        session_id = session.get('session_id')
        if session_id is None:
            error = 'Cannot rate limit without session_id cookie'
            raise MWSServerError(401, error)

        config = current_app.config
        coll = get_db()[config['RATELIMIT_COLLECTION']]
        coll.insert({'session_id': session_id, 'timestamp': datetime.now()})

        delta = timedelta(seconds=config['RATELIMIT_EXPIRY'])
        expiry = datetime.now() - delta
        accesses = coll.find({'session_id': session_id,
                              'timestamp': {'$gt': expiry}})
        if accesses.count() > config['RATELIMIT_QUOTA']:
            raise MWSServerError(429, 'Rate limit exceeded')

        return f(*args, **kwargs)
    return update_wrapper(wrapped_function, f)


@mws.route('/', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
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
@crossdomain(origin=REQUEST_ORIGIN)
@check_session_id
def keep_mws_alive(res_id):
    clients = get_db()[CLIENTS_COLLECTION]
    clients.update({'session_id': session.get('session_id'), 'res_id': res_id},
                   {'$set': {'timestamp': datetime.now()}})
    return empty_success()


@mws.route('/<res_id>/db/<collection_name>/find', methods=['GET'])
@crossdomain(origin=REQUEST_ORIGIN)
@check_session_id
@ratelimit
def db_collection_find(res_id, collection_name):
    # TODO: Should we specify a content type? Then we have to use an options
    # header, and we should probably get the return type from the content-type
    # header.
    parse_get_json(request)
    query = request.json.get('query')
    projection = request.json.get('projection')
    skip = request.json.get('skip', 0)
    limit = request.json.get('limit', 0)

    with UseResId(res_id):
        coll = get_db()[collection_name]
        cursor = coll.find(query, projection, skip, limit)
        documents = list(cursor)
        return to_json({'result': documents})


@mws.route('/<res_id>/db/<collection_name>/insert',
           methods=['POST', 'OPTIONS'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
@check_session_id
@ratelimit
def db_collection_insert(res_id, collection_name):
    # TODO: Ensure request.json is not None.
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
            req_size += len(BSON.encode(d))
    else:
        req_size = len(BSON.encode(document))

    if size + req_size > current_app.config['QUOTA_COLLECTION_SIZE']:
        raise MWSServerError(403, 'Collection size exceeded')

    # Insert document
    with UseResId(res_id):
        get_db()[collection_name].insert(document)
        return empty_success()


@mws.route('/<res_id>/db/<collection_name>/remove',
           methods=['DELETE', 'OPTIONS'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
@check_session_id
@ratelimit
def db_collection_remove(res_id, collection_name):
    constraint = request.json.get('constraint') if request.json else {}
    just_one = request.json and request.json.get('just_one', False)

    with UseResId(res_id):
        collection = get_db()[collection_name]
        if just_one:
            collection.find_and_modify(constraint, remove=True)
        else:
            collection.remove(constraint)
        return empty_success()


@mws.route('/<res_id>/db/<collection_name>/update', methods=['PUT', 'OPTIONS'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
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

        db[collection_name].update(query, update, upsert, multi=multi)
        return empty_success()


@mws.route('/<res_id>/db/<collection_name>/aggregate',
           methods=['GET', 'OPTIONS'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
@check_session_id
def db_collection_aggregate(res_id, collection_name):
    parse_get_json(request)
    try:
        with UseResId(res_id):
            coll = get_db()[collection_name]
            result = coll.aggregate(request.json)
            return to_json(result)
    except OperationFailure as e:
        raise MWSServerError(400, e.message)


@mws.route('/<res_id>/db/<collection_name>/drop',
           methods=['DELETE', 'OPTIONS'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
@check_session_id
@ratelimit
def db_collection_drop(res_id, collection_name):
    with UseResId(res_id):
        get_db().drop_collection(collection_name)
    return empty_success()


@mws.route('/<res_id>/db/<collection_name>/count', methods=['GET'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
@check_session_id
@ratelimit
def db_collection_count(res_id, collection_name):
    parse_get_json(request)
    query = request.json.get('query')
    skip = request.json.get('skip', 0)
    limit = request.json.get('limit', 0)
    use_skip_limit = bool(skip or limit)

    with UseResId(res_id):
        coll = get_db()[collection_name]
        cursor = coll.find(query, skip=skip, limit=limit)
        count = cursor.count(use_skip_limit)
        return to_json({'count': count})


@mws.route('/<res_id>/db/getCollectionNames',
           methods=['GET', 'OPTIONS'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
@check_session_id
def db_get_collection_names(res_id):
    return to_json({'result': get_collection_names(res_id)})


@mws.route('/<res_id>/db',
           methods=['DELETE', 'OPTIONS'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
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
        if 'ns not found' in e.message:
            return 0
        else:
            raise MWSServerError(500, e.message)
