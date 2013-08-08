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
from mongows.initializers.util import (
    load_data_from_mongoexport,
    load_data_from_json,
    load_data_from_mongodump,
)
from mongows.mws.db import get_db
from mongows.mws.util import UseResId, get_collection_names
from mongows.mws.views import CLIENTS_COLLECTION
from mongows.mws.MWSServerError import MWSServerError
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

            def get_collections():
                # Can't use the util function because we would be using it
                # inside the with, so the collection name would be mangled
                return clients_collection.find(
                    {'res_id': res_id},
                    {'_id': 0, 'collections': 1}
                )[0]['collections']

            with UseResId(res_id):
                self.assertItemsEqual(get_collections(), [])
                db.foo.insert({'message': 'test'})
                self.assertItemsEqual(get_collections(), ['foo'])
                self.assertItemsEqual(list(db.foo.find({}, {'_id': 0})),
                                      [{'message': 'test'}])

                db.bar.update({}, {'message': 'test'})
                self.assertItemsEqual(get_collections(), ['foo'])
                db.bar.update({}, {'message': 'test'}, upsert=True)
                self.assertItemsEqual(get_collections(), ['foo', 'bar'])
                self.assertItemsEqual(list(db.bar.find({}, {'_id': 0})),
                                      [{'message': 'test'}])

                db.foo.drop()
                self.assertItemsEqual(get_collections(), ['bar'])
                self.assertNotIn(res_id + 'foo', db.collection_names())
                db.drop_collection('bar')
                self.assertItemsEqual(get_collections(), [])
                self.assertNotIn(res_id + 'bar', db.collection_names())


class QuotaCollectionsTestCase(UseResIdTestCase):
    def setUp(self):
        super(QuotaCollectionsTestCase, self).setUp()
        self.old_quota = self.real_app.config['QUOTA_NUM_COLLECTIONS']
        self.res_id = 'myresid.'
        with self.real_app.app_context():
            self.db = get_db()
            collections = get_collection_names(self.res_id)
            with UseResId(self.res_id):
                for c in collections:
                    self.db.drop_collection(c)

    def tearDown(self):
        self.real_app.config['QUOTA_NUM_COLLECTIONS'] = self.old_quota

    def test_quota_collections(self):
        self.real_app.config['QUOTA_NUM_COLLECTIONS'] = 2

        with self.real_app.app_context(), UseResId(self.res_id):
            self.db.a.insert({'a': 1})
            self.db.b.insert({'a': 1})
            with self.assertRaises(MWSServerError) as cm:
                self.db.c.insert({'a': 1})

            self.assertEqual(cm.exception.error, 429)

            for c in ['a', 'b']:
                self.db.drop_collection(c)

    def test_quota_collections_zero(self):
        self.real_app.config['QUOTA_NUM_COLLECTIONS'] = 0

        with self.real_app.app_context(), UseResId(self.res_id):
            with self.assertRaises(MWSServerError) as cm:
                self.db.a.insert({'a': 1})

            self.assertEqual(cm.exception.error, 429)

            self.db.drop_collection('a')


class InitializersTestCase(MongoWSTestCase):
    def mock_open(self, open_mock, contents):
        file_wrapper = mock.MagicMock(spec=file)
        open_mock.return_value = file_wrapper
        file_handle = StringIO.StringIO(contents)
        file_wrapper.__enter__.return_value = file_handle

    @mock.patch('__builtin__.open')
    def test_loads_exported_data(self, open_mock):
        documents = [
            {'_id': 1, 'msg': 'my test string'},
            {'_id': 2, 'message': 'my other string'},
            {'_id': 3, 'foo': 'bar', 'greeting': 'hi there'},
        ]
        file_contents = '\n'.join([dumps(doc) for doc in documents])
        self.mock_open(open_mock, file_contents)

        with self.real_app.app_context():
            db = get_db()

            # Test normally (keeping the _id)
            load_data_from_mongoexport('myresid.', 'my/file/location',
                                       'mycoll')
            open_mock.assert_called_with('my/file/location')
            collection_contents = list(db['myresid.mycoll'].find())
            self.assertItemsEqual(collection_contents, documents)

            db['myresid.mycoll'].drop()

            # Test removing the _id
            load_data_from_mongoexport('myresid.', 'my/file/location',
                                       'mycoll', True)
            collection_contents = list(db['myresid.mycoll'].find())
            for doc in collection_contents:
                # Should not be any of the given _id's
                self.assertNotIn(doc['_id'], (1, 2, 3))
            db['myresid.mycoll'].drop()

    @mock.patch('__builtin__.open')
    def test_loads_exported_array_data(self, open_mock):
        documents = [
            {'_id': 1, 'msg': 'my test string'},
            {'_id': 2, 'message': 'my other string'},
            {'_id': 3, 'foo': 'bar', 'greeting': 'hi there'},
        ]
        file_contents = dumps(documents)
        self.mock_open(open_mock, file_contents)

        with self.real_app.app_context():
            db = get_db()

            load_data_from_mongoexport('myresid.',
                                       'my/file/location', 'mycoll')

            open_mock.assert_called_with('my/file/location')
            collection_contents = list(db['myresid.mycoll'].find())
            self.assertItemsEqual(collection_contents, documents)

            db['myresid.mycoll'].drop()

    @mock.patch('__builtin__.open')
    def test_loads_json_data(self, open_mock):
        documents = {
            'first_coll': [
                {'_id': 1, 'msg': 'my test string'},
                {'_id': 2, 'message': 'my other string'},
                {'_id': 3, 'foo': 'bar', 'greeting': 'hi there'},
            ],
            'viewing_preferences': [
                {'_id': 2, 'tv_shows': ['archer', 'firefly']},
                {'_id': 3, 'tv_shows': ['arrested development'],
                 'movies': ['shawshank redemption']},
            ],
        }
        file_contents = dumps(documents)

        with self.real_app.app_context():
            db = get_db()

            # Test normally (keeping the _id)
            self.mock_open(open_mock, file_contents)
            load_data_from_json('myresid.', 'my/file/location')

            open_mock.assert_called_with('my/file/location')
            first_coll_contents = list(db['myresid.first_coll'].find())
            self.assertItemsEqual(first_coll_contents, documents['first_coll'])
            viewing_prefs_contents = list(
                db['myresid.viewing_preferences'].find()
            )
            self.assertItemsEqual(viewing_prefs_contents,
                                  documents['viewing_preferences'])

            db['myresid.first_coll'].drop()
            db['myresid.viewing_preferences'].drop()

            # Test removing the _id's
            self.mock_open(open_mock, file_contents)
            load_data_from_json('myresid.', 'my/file/location', True)

            first_coll_contents = list(db['myresid.first_coll'].find())
            for doc in first_coll_contents:
                self.assertNotIn(doc['_id'], (1, 2, 3))
            viewing_prefs_contents = list(
                db['myresid.viewing_preferences'].find()
            )
            for doc in viewing_prefs_contents:
                self.assertNotIn(doc['_id'], (1, 2, 3))

            db['myresid.first_coll'].drop()
            db['myresid.viewing_preferences'].drop()

    @mock.patch('mongows.initializers.util.Popen')
    @mock.patch('mongows.initializers.util.os')
    def test_loads_dumped_bson_data(self, os_mock, Popen_mock):
        popen_instance = mock.MagicMock()
        popen_instance.poll.return_value = 0
        Popen_mock.return_value = popen_instance
        os_mock.path.exists.return_value = True

        with self.real_app.app_context():
            res_id = 'myresid.'
            collection_name = 'collname'
            dump_location = '/my/dump/location'
            load_data_from_mongodump(res_id, dump_location, collection_name)
            Popen_mock.assert_called_with((
                'mongorestore',
                '-d', 'mws',
                '-c', '%s%s' % (res_id, collection_name),
                dump_location
            ))
            popen_instance.communicate.assert_called_once_with()  # no args
            self.assertIn(collection_name, get_collection_names(res_id))

    @mock.patch('mongows.initializers.util.Popen')
    @mock.patch('mongows.initializers.util.os')
    def test_loading_nonexistant_dump_throws_404(self, os_mock, Popen_mock):
        # Popen_mock is needed to make sure a subprocess isn't actually created
        run_load = lambda: load_data_from_mongodump('myresid.',
                                                    '/does/not/exist',
                                                    'collname')
        os_mock.path.exists.return_value = False
        self.assertRaises(NotFound, run_load)

    @mock.patch('mongows.initializers.util.Popen')
    @mock.patch('mongows.initializers.util.os')
    def test_mongorestore_errors_throw_500(self, os_mock, Popen_mock):
        os_mock.path.exists.return_value = True
        popen_instance = mock.MagicMock()
        Popen_mock.return_value = popen_instance
        popen_instance.poll.return_value = 1  # error code from mongorestore

        run_load = lambda: load_data_from_mongodump('myresid.',
                                                    '/does/not/exist',
                                                    'collname')

        self.assertRaises(InternalServerError, run_load)
