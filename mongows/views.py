from flask import request, session

from mongows import app
from mongows.db import get_connection

@app.route('/')
def hello():
    db = get_connection()
    emptyset = db.some_collection.find()
    return 'Hello World! {0}'.format(emptyset.count())

@app.route('/db', methods=['POST'])
def db_post():
    db = get_connection()
    id = session.get('id')
    if id == None:
        id = generateId()
    # TODO: create new collection with id
    return '/db Not Implemented'

@app.route('/db/:id', methods=['POST'])
def db_id_post():
    id = session.get('id')
    if id == None:
        # TODO: return session error
        pass
    # TODO: call mongo and return results
    query = request.form['query']
    return '/db/:id Not Implemented'

@app.route('/db/:id/keep-alive', methods=['POST'])
def db_id_keep-alive():
    id = session.get('id')
    # TODO: call mongo to keep session alive
    return 'keep-alive Not Implemented'
