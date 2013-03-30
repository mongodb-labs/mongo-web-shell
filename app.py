from urlparse import urlparse
import logging
import os

from flask import Flask
import pymongo

app = Flask(__name__)
_logger = logging.getLogger(__name__)
db = None

def get_connection():
    global db
    if db:
        return db
    config = urlparse(os.environ.get('MONGOHQ_URL', 'http://localhost:27017/db'))
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
    # Bind to PORT if defined, otherwise default to 5000.
    port = int(os.environ.get('PORT', 5000))
    app.debug = True
    app.run(host='0.0.0.0', port=port)
