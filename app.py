from urlparse import urlparse
import logging
import os

from flask import Flask
import pymongo

HOST= '0.0.0.0'
PORT = int(os.environ.get('PORT', 5000))
MONGO_URL = os.environ.get('MONGOHQ_URL', 'http://localhost:27017/db')
DEBUG = True

app = Flask(__name__)
_logger = logging.getLogger(__name__)
db = None

def get_connection():
    global db
    if db:
        return db
    config = urlparse(MONGO_URL)
    db_name = config.path.rpartition('/')[2]
    connection = pymongo.Connection(config.hostname, config.port)
    db = connection[db_name]
    if config.username:
        db.authenticate(config.username, config.password)
    return db

@app.route('/')
def hello():
    db = get_connection()
    emptyset = db.some_collection.find()
    return 'Hello World! {0}'.format(emptyset.count())

if __name__ == '__main__':
    app.run(host=HOST, port=PORT, debug=DEBUG)
