from mongows.mws.db import get_db
from mongows.mws.util import UseResId
from tests import MongoWSTestCase


class UseResIdTestCase(MongoWSTestCase):
    def test_mangles_collection_names_automatically(self):
        with self.real_app.app_context():
            db = get_db()
            with UseResId('myresid.'):
                coll = db.foo
                self.assertEqual(coll.name, 'myresid.foo')
            coll = db.foo
            self.assertEqual(coll.name, 'foo')
