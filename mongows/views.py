import random
from datetime import timedelta
from functools import update_wrapper
import json

from bson.json_util import dumps
from bson.objectid import ObjectId
from flask import current_app, make_response, request

from mongows import app, db

REQUEST_ORIGIN = '*'  # TODO: Get this value from app config.
client_db = 

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


@app.route('/mws', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def create_mws_resource():
    # For now, the rest of the code uses resource ID as the name of the
    # database to be queried. So I am hardconding it to test. It is yet to be
    # decided how and where to maintain the relationship between the user,
    # her resource ID and the database she can query.
    # result = {'res_id': 'test'}

    if 'db_name' in request.json:
        db_name = request.json['document']
    else:
        error = '\'db_name\' argument not found in the creation request.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
        return result

    objIDs = db.collection_insert(res_id, collection_name, document)
    result = {'status': 0, 'result': objIDs}
    try:
        result = dumps(result)
    except ValueError:
        error = 'Error in insert function while trying to convert the ' + \
            'results to JSON format.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
    return result
    return dumps(result)

@app.route('/mws/<res_id>/keep-alive', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def keep_mws_alive(res_id):
    # TODO: Reset timeout period on mws resource with the given id.
    return '{}'

@app.route('/mws/<res_id>/db/<collection_name>/find', methods=['GET'])
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

    cursor = db.collection_find(res_id, collection_name, query, projection)
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


@app.route('/mws/<res_id>/db/<collection_name>/insert',
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

    objIDs = db.collection_insert(res_id, collection_name, document)
    result = {'status': 0, 'result': objIDs}
    try:
        result = dumps(result)
    except ValueError:
        error = 'Error in insert function while trying to convert the ' + \
            'results to JSON format.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
    return result

def generateId():
    # we're intentionally excluding 0, O, I, and 1 for readability
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join([chars[int(random.random() * len(chars))] for i in range(12)])
