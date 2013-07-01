import StringIO
from bson.json_util import dumps
import mock
from mongows.initializers.util import (
    load_data_from_mongoexport,
    load_data_from_json,
)
from mongows.mws.db import get_db
from mongows.mws.util import UseResId
from mongows.mws.views import CLIENTS_COLLECTION
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
                return clients_collection.find(
                    {'res_id': res_id},
                    {'_id': 0, 'collections': 1}
                )[0]['collections']

            with UseResId(res_id):
                self.assertItemsEqual(get_collections(), [])
                db.foo.insert({'message': 'test'})
                self.assertItemsEqual(get_collections(), ['foo'])

                db.bar.update({}, {'message': 'test'})
                self.assertItemsEqual(get_collections(), ['foo'])
                db.bar.update({}, {'message': 'test'}, upsert=True)
                self.assertItemsEqual(get_collections(), ['foo', 'bar'])

                db.foo.drop()
                self.assertItemsEqual(get_collections(), ['bar'])
                db.drop_collection('bar')
                self.assertItemsEqual(get_collections(), [])


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
