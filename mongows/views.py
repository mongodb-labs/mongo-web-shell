from flask import request, redirect

from mongows import app
from mongows.db import get_connection

@app.route('/')
def hello():
    db = get_connection()
    emptyset = db.some_collection.find()
    return 'Hello World! {0}'.format(emptyset.count())

@app.route('/mws', methods=['POST'])
def create_mws_resource():
    # TODO: Create resource and return its associated id.
    # Call method to create resource
    id = 0 # get id from 
    return '/mws/: Not yet implemented.'

@app.route('/mws/<res_id>/keep-alive', methods=['POST'])
def keep_mws_alive(res_id):
    # TODO: Reset timeout period on mws resource with the given id.
    # find.extend(res_id) 
    return '/mws/:id/keep-alive: Not yet implemented.'

@app.route('/mws/<res_id>/db/<collection_name>/find', methods=['GET'])
def db_collection_find(res_id, collection_name):
    # TODO: Call find() on the specified params and return results.
    cookie_id = request.cookies.get(id)
    collection_cookie = None # Get cookie id from collection name
    if (cookie_id != collection_cookie):
        error_type = 'Bad_Request'
        return redirect(url_for('/mws/<res_id>/<error_type>', % res_id, error_type))
    return '/mws/:id/db/:collection/find: Not yet implemented.'

@app.route('/mws/<res_id>/db/<collection_name>/insert', methods=['POST'])
def db_collection_insert(res_id, collection_name):
    # TODO: Call insert() on the specified params, return status.
    cookie_id = request.cookies.get(id)
    collection_cookie = None # Get cookie id from collection name
    if (cookie_id != collection_cookie):
        error_type = 'Bad_Request'
    return '/mws/:id/db/:collection/insert: Not yet implemented.'

@app.route('/mws/<res_id>/<error_type>' methods=['GET', 'POST'])
def db_bad_query(res_id, error_type):
    return '/mws/<res_id>/<error_type>' % res_id, error_type
