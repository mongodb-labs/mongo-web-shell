from urlparse import urlparse

from flask import current_app
import pymongo

from mongows.mws.MWSServerError import MWSServerError

db = None


def get_db(MWSExceptions=True):
    global db
    # TODO: Ensure MongoClient connection is still active.
    if db:
        return db
    config = urlparse(current_app.config['MONGOHQ_URL'])
    db_name = config.path.rpartition('/')[2]
    try:
        client = pymongo.MongoClient(config.hostname, config.port)
        db = client[db_name]
        if config.username:
            db.authenticate(config.username, config.password)
        return db
    except Exception as e:
        if MWSExceptions:
            debug = current_app.config['DEBUG']
            msg = str(e) if debug else 'An unexpected error occurred.'
            raise MWSServerError(500, msg)
        raise
