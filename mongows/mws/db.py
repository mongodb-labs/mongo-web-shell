from urlparse import urlparse

from flask import current_app
import pymongo

db = None


def get_db():
    global db
    # TODO: Ensure MongoClient connection is still active.
    if db:
        return db
    config = urlparse(current_app.config['MONGOHQ_URL'])
    db_name = config.path.rpartition('/')[2]
    try:
        client = pymongo.MongoClient(config.hostname, config.port)
    except TypeError:
        print 'Port is not an instance of int.'
        # TODO: Throw appropriate exception
    except ConnectionFailure:
        print 'Connection to the database could not be made.'
        # TODO: Propogate the exception
    except AutoReconnect:
        print 'Auto-reconnection performed.'
        # TODO: Propogate the exception
    else:
        db = client[db_name]
        if config.username:
            db.authenticate(config.username, config.password)
        return db
    return None


def collection_find(res_id, collection, query, projection):
    db = get_db()
    # TODO: Check collection is a valid collection name or catch the exception.
    return db[collection].find(query, projection)


def collection_insert(res_id, collection, document):
    db = get_db()
    # TODO: Check collection is a valid collection name or catch the exception.
    return db[collection].insert(document)
