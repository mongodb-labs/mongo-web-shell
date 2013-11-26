from datetime import datetime, timedelta
from functools import update_wrapper
from flask import current_app, session

from .MWSServerError import MWSServerError
from .db import get_db
from . import CLIENTS_COLLECTION


def user_has_access(res_id, session_id):
    query = {'res_id': res_id, 'session_id': session_id}
    coll = get_db()[CLIENTS_COLLECTION]
    return_value = coll.find_one(query)
    return False if return_value is None else True


def check_session_id(f):
    def wrapped_function(*args, **kwargs):
        session_id = session.get('session_id')
        if session_id is None:
            raise MWSServerError(401, 'There is no session_id cookie')
        if not user_has_access(kwargs['res_id'], session_id):
            error = 'Session error. User does not have access to res_id'
            raise MWSServerError(403, error)
        return f(*args, **kwargs)
    return update_wrapper(wrapped_function, f)


def ratelimit(f):
    def wrapped_function(*args, **kwargs):
        session_id = session.get('session_id')
        if session_id is None:
            error = 'Cannot rate limit without session_id cookie'
            raise MWSServerError(401, error)

        config = current_app.config
        coll = get_db()[config['RATELIMIT_COLLECTION']]
        coll.insert({'session_id': session_id, 'timestamp': datetime.now()})

        delta = timedelta(seconds=config['RATELIMIT_EXPIRY'])
        expiry = datetime.now() - delta
        accesses = coll.find({'session_id': session_id,
                              'timestamp': {'$gt': expiry}})
        if accesses.count() > config['RATELIMIT_QUOTA']:
            raise MWSServerError(429, 'Rate limit exceeded')

        return f(*args, **kwargs)
    return update_wrapper(wrapped_function, f)
