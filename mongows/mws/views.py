from datetime import timedelta
from functools import update_wrapper
import json
import random

from bson.json_util import dumps
from flask import Blueprint, current_app, make_response, request, session

from . import db

mws = Blueprint('mws', __name__, url_prefix='/mws')

CLIENTS_COLLECTION = 'clients'
#DB = db.get_db()
ID_SIZE = 12
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


@mws.route('/', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def create_mws_resource():
    res_id = generate_res_id()
    session_id = ''
    if 'session_id' in session:
        session_id = session['session_id']
    else:
        session_id = generate_id()
        session['session_id'] = session_id
    result = {'res_id': res_id, 'session_id': session_id}
    db.get_db()[CLIENTS_COLLECTION].insert(result)
    return dumps(result)


@mws.route('/<res_id>/keep-alive', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def keep_mws_alive(res_id):
    # TODO: Reset timeout period on mws resource with the given id.
    return '{}'


@mws.route('/<res_id>/db/<collection_name>/find', methods=['GET'])
@crossdomain(origin=REQUEST_ORIGIN)
def db_collection_find(res_id, collection_name):
    # TODO: Should we specify a content type? Then we have to use an options
    # header, and we should probably get the return type from the content-type
    # header.
    # TODO: Is there an easier way to convert these JSON args? Automatically?
    try:
        query = json.loads(request.args.get('query', '{}')) or None
        projection = json.loads(request.args.get('projection', '{}')) or None
    except ValueError:
        # TODO: Return proper error to client.
        error = 'Error parsing JSON parameters.'
        return {'status': -1, 'result': error}
    session_id = session['session_id']
    internal_collection_name = get_internal_collection_name(res_id,
                                                            collection_name)
    if(check_session_validity(res_id, session_id) is False):
        error = 'Session error. User does not have access to res_id'
        return {'status': -1, 'result': error}
    cursor = db.get_db()[internal_collection_name].find(query, projection)
    documents = list(cursor)
    result = {'status': 0, 'result': documents}
    try:
        result = dumps(result)
    except ValueError:
        error = 'Error in find while trying to convert the results to ' + \
            'JSON format.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
    return result


@mws.route('/<res_id>/db/<collection_name>/insert',
           methods=['POST', 'OPTIONS'])
@crossdomain(headers='Content-type', origin=REQUEST_ORIGIN)
def db_collection_insert(res_id, collection_name):
    # TODO: Ensure request.json is not None.
    if 'document' in request.json:
        document = request.json['document']
    else:
        error = '\'document\' argument not found in the insert request.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
        return result
    internal_collection_name = get_internal_collection_name(res_id,
                                                            collection_name)
    session_id = session['session_id']
    if(check_session_validity(res_id, session_id) is False):
        error = 'Session error. User does not have access to res_id'
        return {'status': -1, 'result': error}
    objIDs = db.get_db()[internal_collection_name].insert(document)
    result = {'status': 0, 'result': objIDs}
    try:
        result = dumps(result)
    except ValueError:
        error = 'Error in insert function while trying to convert the ' + \
            'results to JSON format.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
    return result


def get_internal_collection_name(res_id, collection_name):
    return res_id + collection_name


def generate_res_id():
    res_id = ''
    exists = ''
    while(exists is not None):
        res_id = generate_id()
        exists = db.get_db()[CLIENTS_COLLECTION].find_one({'res_id': res_id})
    return res_id


def generate_id():
    # we're intentionally excluding 0, O, I, and 1 for readability
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join([chars[int(random.random() * len(chars))] for i in
                    range(ID_SIZE)])


def check_session_validity(res_id, session_id):
    query = {'res_id': res_id, 'session_id': session_id}
    return_value = db.get_db()[CLIENTS_COLLECTION].find_one(query)
    return False if return_value is None else True
