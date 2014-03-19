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
from pymongo.errors import OperationFailure
from db import get_db
from MWSServerError import MWSServerError
from flask import current_app
from . import CLIENTS_COLLECTION

import logging
import os

_logger = logging.getLogger(__name__)


def get_collection_names(res_id):
    """
    Get the collection names associated with a given resource id. Should not be
    called from within a 'with UseResId(res_id)' block.
    """
    one = get_db()[CLIENTS_COLLECTION].find_one(
        {'res_id': res_id}, {'collections': 1, '_id': 0}
    )
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

def to_coll_name(res_id, name):
    return "{0}{1}".format(res_id, name)

class WrappedCollection(object):

    def __init__(self, db, coll_name, res_id):
        self.res_id = res_id
        self.db = db
        self.unqualified_name = coll_name

        self.db.ensure_client_collection(coll_name)

        coll_name = to_coll_name(self.res_id, coll_name)
        self.coll = self.db.db[coll_name]


    @property
    def name(self):
        return self.coll.name

    def insert(self, *args, **kwargs):
        return self.coll.insert(*args, **kwargs)

    def update(self, *args, **kwargs):
        return self.coll.update(*args, **kwargs)

    def save(self, *args, **kwargs):
        return self.coll.save(*args, **kwargs)

    def find(self, *args, **kwargs):
        return self.coll.find(*args, **kwargs)

    def find_and_modify(self, *args, **kwargs):
        return self.coll.find_and_modify(*args, **kwargs)

    def aggregate(self, *args, **kwargs):
        return self.coll.aggregate(*args, **kwargs)

    def remove(self, *args, **kwargs):
        return self.coll.remove(*args, **kwargs)

    def drop(self):
        return self.db.drop_collection(self.unqualified_name)

    def size(self):
        try:
            return self.db.db.command({'collstats': self.coll.name}).get('size', 0)
        except OperationFailure as e:
            return 0


class WrappedDatabase(object):

    def __init__(self, database, res_id):
        self.db = database
        self.res_id = res_id

    def __getitem__(self, name):
        return WrappedCollection(self, name, self.res_id)

    def __getattr__(self, name):
        return WrappedCollection(self, name, self.res_id)

    def drop_database(self):
        collections = self.db[CLIENTS_COLLECTION].find_one(
            {'res_id': self.res_id},
            {'collections': 1}
        )
        for collection in collections['collections']:
            self.drop_collection(collection)

    def drop_collection(self, name):
        self.db.drop_collection(to_coll_name(self.res_id, name))
        self.remove_client_collection(name)

    def ensure_client_collection(self, name):
        limit = current_app.config.get('QUOTA_NUM_COLLECTIONS')

        if limit is not None:
            data = self.db[CLIENTS_COLLECTION].find_one(
                {'res_id': self.res_id},
                {'collections': 1}
            )

            if data and len(set(data['collections']).union([name])) > limit:
                raise MWSServerError(429, 'Max number of collections exceeded')

        self.db[CLIENTS_COLLECTION].update(
            {'res_id': self.res_id},
            {'$addToSet': {'collections': name}},
            multi=True
        )

    def remove_client_collection(self, name):
        self.db[CLIENTS_COLLECTION].update(
            {'res_id': self.res_id},
            {'$pull': {'collections': name}},
            multi=True
        )


class UseResId:
    def __init__(self, res_id):
        self.res_id = str(res_id)

    def __enter__(self):
        return WrappedDatabase(get_db(), self.res_id)

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass
