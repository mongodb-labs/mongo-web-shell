from datetime import timedelta
from flask import current_app, make_response, request
from functools import update_wrapper

from mongows import app
from mongows.db import get_connection

REQUEST_ORIGIN = '*' # TODO: Get this value from app config.

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
    db = get_connection()
    emptyset = db.some_collection.find()
    return 'Hello World! {0}'.format(emptyset.count())

@app.route('/mws', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def create_mws_resource():
    # TODO: Create resource and return its associated id.
    return '{}'

@app.route('/mws/<res_id>/keep-alive', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def keep_mws_alive(res_id):
    # TODO: Reset timeout period on mws resource with the given id.
    return '{}'

@app.route('/mws/<res_id>/db/<collection_name>/find', methods=['GET'])
@crossdomain(origin=REQUEST_ORIGIN)
def db_collection_find(res_id, collection_name):
    # TODO: Call find() on the specified params and return results.
    return '{}'

@app.route('/mws/<res_id>/db/<collection_name>/insert', methods=['POST'])
@crossdomain(origin=REQUEST_ORIGIN)
def db_collection_insert(res_id, collection_name):
    # TODO: Call insert() on the specified params, return status.
    return '{}'
