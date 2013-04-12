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
    return '/mws: Not yet implemented.'

@app.route('/mws/<res_id>/keep-alive', methods=['POST'])
def keep_mws_alive(res_id):
    # TODO: Reset timeout period on mws resource with the given id.
    return '/mws/:id/keep-alive: Not yet implemented.'

@app.route('/mws/<res_id>/db/<collection_name>/find', methods=['GET'])
def db_collection_find(res_id, collection_name):
    # TODO: Call find() on the specified params and return results.
    return '/mws/:id/db/:collection/find: Not yet implemented.'

@app.route('/mws/<res_id>/db/<collection_name>/insert', methods=['POST'])
def db_collection_insert(res_id, collection_name):
    # TODO: Call insert() on the specified params, return status.
    return '/mws/:id/db/:collection/insert: Not yet implemented.'
