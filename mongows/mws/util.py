from pymongo.collection import Collection
from pymongo.database import Database
import mongows
from mongows.mws.db import get_db


def get_internal_coll_name(res_id, collection_name):
    return '%s%s' % (res_id, collection_name)


class UseResId:
    def __init__(self, res_id):
        self.res_id = str(res_id)
        self.id_length = len(res_id)
        self.client_collection = get_db()[mongows.mws.views.CLIENTS_COLLECTION]

    def __enter__(self):
        self.old_get_attr = Database.__getattr__
        self.old_drop_collection = Database.drop_collection

        def __getattr__(db, name):
            if not (name.startswith("oplog.$main") or name.startswith("$cmd")):
                name = '%s%s' % (self.res_id, name)
            return self.old_get_attr(db, name)

        def drop_collection(db, name):
            self.old_drop_collection(db, name)
            if isinstance(name, Collection):
                name = name.name
            self.remove_client_collection(name)
        Database.__getattr__ = __getattr__
        Database.drop_collection = drop_collection

        self.old_insert = Collection.insert
        self.old_update = Collection.update

        def insert(coll, *args, **kwargs):
            self.insert_client_collection(coll.name)
            self.old_insert(coll, *args, **kwargs)

        def update(coll, *args, **kwargs):
            if kwargs.get('upsert', False):
                self.insert_client_collection(coll.name)
            self.old_update(coll, *args, **kwargs)

        Collection.insert = insert
        Collection.update = update

    def __exit__(self, exc_type, exc_val, exc_tb):
        Database.__getattr__ = self.old_get_attr
        Database.drop_collection = self.old_drop_collection
        Collection.insert = self.old_insert
        Collection.update = self.old_update

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
