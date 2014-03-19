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

import StringIO
from bson.json_util import dumps
import mock
from werkzeug.exceptions import NotFound, InternalServerError
from webapps.lib.db import get_db
from webapps.lib.util import UseResId, get_collection_names
from webapps.lib import CLIENTS_COLLECTION
from webapps.lib.MWSServerError import MWSServerError
from tests import MongoWSTestCase


class UseResIdTestCase(MongoWSTestCase):
    def test_mangles_collection_names_automatically(self):
        with self.real_app.app_context():
            with UseResId('myresid.') as db:
                coll = db.foo
                self.assertEqual(coll.name, 'myresid.foo')

    def test_updates_collection_list(self):
        with self.real_app.app_context():
            db = get_db()
            res_id = 'myresid.'

            # Setup resource id record
            clients_collection = db[CLIENTS_COLLECTION]
            clients_collection.remove({'res_id': res_id})
            clients_collection.insert({
                'res_id': res_id,
                'collections': []
            })

            with UseResId(res_id) as db:
                self.assertItemsEqual(get_collection_names(res_id), [])
                db.foo.insert({'message': 'test'})
                self.assertItemsEqual(get_collection_names(res_id), ['foo'])
                self.assertItemsEqual(list(db.foo.find({}, {'_id': 0})),
                                      [{'message': 'test'}])

                db.bar.update({}, {'message': 'test'}, upsert=True)
                self.assertItemsEqual(get_collection_names(res_id), ['foo', 'bar'])
                self.assertItemsEqual(list(db.bar.find({}, {'_id': 0})),
                                      [{'message': 'test'}])

                db.foo.drop()
                self.assertItemsEqual(get_collection_names(res_id), ['bar'])
                self.assertNotIn(res_id + 'foo', get_collection_names(res_id))


class QuotaCollectionsTestCase(UseResIdTestCase):
    def setUp(self):
        super(QuotaCollectionsTestCase, self).setUp()
        self.old_quota = self.real_app.config['QUOTA_NUM_COLLECTIONS']
        self.res_id = 'myresid.'
        with self.real_app.app_context():
            collections = get_collection_names(self.res_id)
            with UseResId(self.res_id) as db:
                for c in collections:
                    db.drop_collection(c)

    def tearDown(self):
        self.real_app.config['QUOTA_NUM_COLLECTIONS'] = self.old_quota

    def test_quota_collections(self):
        self.real_app.config['QUOTA_NUM_COLLECTIONS'] = 2

        with self.real_app.app_context():
            with UseResId(self.res_id) as db:
                db.a.insert({'a': 1})
                db.b.insert({'b': 1})
                with self.assertRaises(MWSServerError) as cm:
                    db.c.insert({'c': 1})
                    self.assertEqual(cm.exception.error, 429)

                for c in ['a', 'b']:
                    db.drop_collection(c)

    def test_quota_collections_zero(self):
        self.real_app.config['QUOTA_NUM_COLLECTIONS'] = 0

        with self.real_app.app_context():
            with UseResId(self.res_id) as db:
                with self.assertRaises(MWSServerError) as cm:
                    db.a.insert({'a': 1})
                    self.assertEqual(cm.exception.error, 429)

                db.drop_collection('a')
