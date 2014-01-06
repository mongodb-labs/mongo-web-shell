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

import logging
from urlparse import urlparse

from flask import current_app
import pymongo
from pymongo.cursor_manager import CursorManager

from MWSServerError import MWSServerError

_logger = logging.getLogger(__name__)

db = None


class KeepAliveCursorManager(CursorManager):
    """A cursor manager that does not kill cursors
    """
    def close(self, cursor_id):
        # refuse to kill the cursor
        pass


def get_keepalive_db(MWSExceptions=True):
    config = current_app.config
    try:
        client = pymongo.MongoClient(
            config.get('DB_HOST'),
            config.get('DB_PORT'))
        client.set_cursor_manager(KeepAliveCursorManager)
        db = client[config.get('DB_NAME')]
        if 'username' in config:
            db.authenticate(config.get('username'), config.get('password'))
        return db
    except Exception as e:
        if MWSExceptions:
            debug = config['DEBUG']
            msg = str(e) if debug else 'An unexpected error occurred.'
            raise MWSServerError(500, msg)
        raise


def get_db(MWSExceptions=True):
    global db
    config = current_app.config
    # TODO: Ensure MongoClient connection is still active.
    if db:
        return db
    try:
        client = pymongo.MongoClient(
            config.get('DB_HOSTS'),
            config.get('DB_PORT'))
        db = client[config.get('DB_NAME')]
        if 'username' in config:
            db.authenticate(config.get('username'), config.get('password'))
        return db
    except Exception as e:
        if MWSExceptions:
            debug = config['DEBUG']
            msg = str(e) if debug else 'An unexpected error occurred.'
            raise MWSServerError(500, msg)
        raise
