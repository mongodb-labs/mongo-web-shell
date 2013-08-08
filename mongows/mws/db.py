#    Copyright 2013 10gen Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.

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
