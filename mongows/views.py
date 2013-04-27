from datetime import timedelta
from functools import update_wrapper

from bson.json_util import dumps
from flask import current_app, make_response, request

from mongows import app, db

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


@app.route('/')
def hello():
    db_name = config.path.rpartition('/')[2]
    mongo_client = db.get_connection()
    db = mongo_client[db_name]
    emptyset = db.some_collection.find()
    return 'Hello World! {0}'.format(emptyset.count())


@app.route('/mws', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def create_mws_resource():
    # For now, the rest of the code uses resource ID as the name of the
    # database to be queried. So I am hardconding it to test. It is yet to be
    # decided how and where to maintain the relationship between the user,
    # her resource ID and the database she can query.
    result = {'res_id': 'test'}
    return dumps(result)


@app.route('/mws/<res_id>/keep-alive', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def keep_mws_alive(res_id):
    # TODO: Reset timeout period on mws resource with the given id.
    return '{}'


@app.route('/mws/<res_id>/db/<collection_name>/find', methods=['GET'])
@crossdomain(origin=REQUEST_ORIGIN)
def db_collection_find(res_id, collection_name):
    if 'query' in request.json:
        query = request.json['query']
    else:
        query = {}

    if 'projection' in request.json:
        projection = request.json['projection']
    else:
        projection = {}

    mongo_cursor = db.collection_find(res_id, collection_name, query,
                                      projection)
    # Get the results from the cursor and convert it to JSON format before
    # returning
    rows = list(mongo_cursor)
    result = {'status': 0, 'result': rows}
    try:
        result = dumps(result)
    except ValueError:
        error = 'Error in find while trying to convert the results to ' + \
            'JSON format.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
    return result


@app.route('/mws/<res_id>/db/<collection_name>/insert', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def db_collection_insert(res_id, collection_name):
    if 'document' in request.json:
        document = request.json['document']
    else:
        error = '\'document\' argument not found in the insert request.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
        return result

    ObjIds = db.collection_insert(res_id, collection_name, document)
    result = {'status': 0, 'result': ObjIds}
    try:
        result = dumps(result)
    except ValueError:
        error = 'Error in insert function while trying to convert the ' + \
            'results to JSON format.'
        result = {'status': -1, 'result': error}
        result = dumps(result)
    return result
