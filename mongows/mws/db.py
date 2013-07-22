from urlparse import urlparse

from flask import current_app
import pymongo

from pymongo.errors import ConnectionFailure, AutoReconnect

db = None


def get_db():
    global db
    # TODO: Ensure MongoClient connection is still active.
    if db:
        return db
    config = urlparse(current_app.config['MONGOHQ_URL'])
    db_name = current_app.config['DB_NAME']
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
