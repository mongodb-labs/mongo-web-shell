from flask import jsonify
from flask import render_template
from flask import request
from bson.json_util import dumps
from mongows import app
from mongows.db import get_connection
from mongows.util import parse_arguments, try_number

client = get_connection()
db = client.test_database

@app.route('/')
def hello():
    emptyset = db.some_collection.find()
    return 'Hello World! {0}'.format(emptyset.count())

@app.route('/shell')
def shell():
    return render_template("shell.html")

@app.route('/find', methods = ['POST'])
def find():
    collection = request.form['collection']
    arguments = request.form['arguments']
    if arguments:
        arguments = parse_arguments(arguments)
    else:
        arguments = {}
    answer = list(db[collection].find(arguments))
    answer = dumps(answer)
    return answer

@app.route('/save', methods = ['POST'])
def save():
    collection = request.form['collection']
    arguments = request.form['arguments']
    if not arguments:
        return None
    arguments = parse_arguments(arguments)
    answer = db[collection].save(arguments)
    answer = dumps(answer)
    return answer
