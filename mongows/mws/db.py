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
    db_name = config.path.rpartition('/')[2]
    try:
        client = pymongo.MongoClient(config.hostname, config.port)
    except TypeError:
        print 'Port is not an instance of int.'
        raise
    except ConnectionFailure:
        print 'Connection to the database could not be made.'
        raise
    except AutoReconnect:
        print 'Auto-reconnection performed.'
        raise
    except:
        print 'An unexpected error occurred.'
        raise
    else:
        db = client[db_name]
        if config.username:
            db.authenticate(config.username, config.password)
        return db
