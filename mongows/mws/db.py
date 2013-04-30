from urlparse import urlparse

from flask import current_app
import pymongo

client = None


def get_connection():
    global client
    if client:
        return client
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

    return client


def collection_find(res_id, collection, query, projection):
    mongo_client = get_connection()
    if hasattr(mongo_client, res_id):
        db = mongo_client[res_id]
    else:
        # TODO: Throw an exception
        print 'ERROR: Could not find the DB on server. DB name: ' + res_id

    if not hasattr(db, collection):
        # TODO: Throw an exception
        print 'ERROR: Could not find the collection in DB. ' + \
            'Collection name: ' + collection
    db = client[res_id]
    return db[collection].find(query, projection)


def collection_insert(res_id, collection, document):
    mongo_client = get_connection()
    if hasattr(mongo_client, res_id):
        db = mongo_client[res_id]
    else:
        # TODO: Throw an exception
        print 'ERROR: Could not find the DB on server. DB name: ' + res_id
    if not hasattr(db, collection):
        # TODO: Throw an exception
        print 'ERROR: Could not find the collection in DB. ' + \
              'Collection name: ' + collection
    return db[collection].insert(document)
