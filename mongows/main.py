from urlparse import urlparse

import pymongo

from mongows import app

db = None

def get_connection():
    global db
    if db:
        return db
    config = urlparse(app.config['MONGO_URL'])
    db_name = config.path.rpartition('/')[2]
    connection = pymongo.MongoClient(config.hostname, config.port)
    db = connection[db_name]
    if config.username:
        db.authenticate(config.username, config.password)
    return db
