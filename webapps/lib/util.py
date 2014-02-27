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

from pymongo.collection import Collection
from pymongo.database import Database
from db import get_db
from MWSServerError import MWSServerError
from flask import current_app
from . import CLIENTS_COLLECTION

import logging
import os

_logger = logging.getLogger(__name__)


def get_internal_coll_name(res_id, collection_name):
    return '%s%s' % (res_id, collection_name)


def get_collection_names(res_id):
    """
    Get the collection names associated with a given resource id. Should not be
    called from within a 'with UseResId(res_id)' block.
    """
    one = get_db()[CLIENTS_COLLECTION].find_one(
        {'res_id': res_id}, {'collections': 1, '_id': 0}
    )
    _logger.info("first result: {0}".format(one))
    return one['collections']


def get_environment(basedir):
    """Get the application environment context (e.g., devel, staging, prod).

Determines the context by looking for a corresponding file under basedir.
If there are multiple files, we prefer devel, then staging, and then prod.
If no file exists, then returns the empty string."""
    for env in ('devel', 'staging', 'prod'):
        if os.path.exists(os.path.join(basedir, env)):
            return env
    return ''


class UseResId:
    def __init__(self, res_id):
        self.res_id = str(res_id)
        self.id_length = len(self.res_id)
        self.client_collection = get_db()[CLIENTS_COLLECTION]

    def __enter__(self):
        self.old_get_attr = Database.__getattr__
        self.old_drop_collection = Database.drop_collection

        def __getattr__(db, name):
            if not (name.startswith("oplog.$main") or name.startswith("$cmd")):
                name = '%s%s' % (self.res_id, name)
            return self.old_get_attr(db, name)

        def drop_collection(db, name):
            if isinstance(name, Collection):
                name = name.name
            name = '%s%s' % (self.res_id, name)
            self.remove_client_collection(name)
            self.old_drop_collection(db, name)
        Database.__getattr__ = __getattr__
        Database.drop_collection = drop_collection

        self.old_insert = Collection.insert
        self.old_update = Collection.update
        self.old_drop = Collection.drop

        def insert(coll, *args, **kwargs):
            self.insert_client_collection(coll.name)
            self.old_insert(coll, *args, **kwargs)

        def update(coll, *args, **kwargs):
            if kwargs.get('upsert', False):
                self.insert_client_collection(coll.name)
            self.old_update(coll, *args, **kwargs)

        def drop(coll):
            self.remove_client_collection(coll.name)
            # Call through to db.drop, making sure it doesn't re-mangle
            self.old_drop_collection(coll.database, coll.name)

        Collection.insert = insert
        Collection.update = update
        Collection.drop = drop

    def __exit__(self, exc_type, exc_val, exc_tb):
        Database.__getattr__ = self.old_get_attr
        Database.drop_collection = self.old_drop_collection
        Collection.insert = self.old_insert
        Collection.update = self.old_update
        Collection.drop = self.old_drop

    def insert_client_collection(self, name):
        if name.startswith(self.res_id):
            name = name[self.id_length:]

        limit = current_app.config.get('QUOTA_NUM_COLLECTIONS')

        if limit is not None:
            data = self.client_collection.find_one(
                {'res_id': self.res_id},
                {'collections': 1}
            )

            if len(set(data['collections']).union([name])) > limit:
                raise MWSServerError(429, 'Max number of collections exceeded')

        self.client_collection.update(
            {'res_id': self.res_id},
            {'$addToSet': {'collections': name}},
            multi=True
        )

    def remove_client_collection(self, name):
        if name.startswith(self.res_id):
            name = name[self.id_length:]
        self.client_collection.update(
            {'res_id': self.res_id},
            {'$pull': {'collections': name}},
            multi=True
        )
