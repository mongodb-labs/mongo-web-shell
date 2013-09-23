from webapps.ivs.initializers.util import (
    load_data_from_mongoexport,
    load_data_from_json,
    load_data_from_mongodump,
)


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
