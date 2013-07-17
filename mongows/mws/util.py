from pymongo.collection import Collection
from pymongo.database import Database
import mongows
from mongows.mws.db import get_db
from werkzeug.exceptions import Forbidden


def get_internal_coll_name(res_id, collection_name):
    return '%s%s' % (res_id, collection_name)


def get_collection_names(res_id):
    """
    Get the collection names associated with a given resource id. Should not be
    called from within a 'with UseResId(res_id)' block.
    """
    return get_db()[mongows.mws.views.CLIENTS_COLLECTION].find(
        {'res_id': res_id}, {'collections': 1, '_id': 0}
    )[0]['collections']


class UseResId:
    # Require explicit allowing of access to system.* collections
    def __init__(self, res_id, allowSystem=False):
        self.res_id = str(res_id)
        self.id_length = len(self.res_id)
        self.client_collection = get_db()[mongows.mws.views.CLIENTS_COLLECTION]
        self.allowSystem = allowSystem

    def __enter__(self):
        self.old_get_attr = Database.__getattr__
        self.old_drop_collection = Database.drop_collection

        def __getattr__(db, name):
            # Restrict the system.* collections by default
            if name == 'system' and not self.allowSystem:
                raise Forbidden('Collection name may not begin with system.*')
            if not (name.startswith("oplog.$main") or name.startswith("$cmd")
                    or name == 'system'):
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
