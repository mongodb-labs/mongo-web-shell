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
