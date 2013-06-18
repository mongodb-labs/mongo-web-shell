from bson.json_util import loads, dumps
import datetime
import mock
from mongows.mws.db import get_db
from mongows.mws.views import get_internal_coll_name, ratelimit
from flask import session

from tests import MongoWSTestCase


class ViewsSetUpUnitTestCase(MongoWSTestCase):
    def test_create_mws_resource(self):
        url = '/mws/'
        rv = self.app.post(url)
        response_dict = loads(rv.data)
        self.assertIn('res_id', response_dict)
        res_id = response_dict['res_id']
        self.assertIsNotNone(res_id)

        # check if res_id is unchanged
        rv = self.app.post(url)
        new_res_id = loads(rv.data)['res_id']
        self.assertIsNotNone(new_res_id)
        self.assertEqual(res_id, new_res_id)

    def test_create_mws_resource_new_session(self):
        url = '/mws/'
        rv = self.app.post(url)
        response_dict = loads(rv.data)
        self.assertIn('res_id', response_dict)
        res_id = response_dict['res_id']
        self.assertIsNotNone(res_id)

        with self.app.session_transaction() as sess:
            del sess['session_id']

        # check if res_id is unique
        rv = self.app.post(url)
        new_res_id = loads(rv.data)['res_id']
        self.assertIsNotNone(new_res_id)
        self.assertNotEqual(res_id, new_res_id)

    @mock.patch('mongows.mws.views.datetime')
    def test_keep_mws_alive(self, datetime_mock):
        first = datetime.datetime(2012, 7, 4)
        second = first + datetime.timedelta(days=1)
        datetime_mock.now.return_value = first
        db = get_db()

        # get a session to keep alive
        rv = self.app.post('/mws/')
        res_id = loads(rv.data)['res_id']

        with self.app.session_transaction() as sess:
            session_id = sess['session_id']
            res = db.clients.find({'res_id': res_id, 'session_id': session_id},
                                  {'timestamp': 1})
            _id = res[0]['_id']
            old_ts = res[0]['timestamp']
            self.assertEqual(old_ts, first)

            datetime_mock.now.return_value = second
            url = '/mws/' + res_id + '/keep-alive'
            rv = self.app.post(url)
            self.assertIn('{}', rv.data)
            newres = db.clients.find({'_id': _id}, {'timestamp': 1})
            self.assertEqual(newres[0]['timestamp'], second)

    def test_ratelimit(self):
        rv = self.app.post('/mws/')
        self.res_id = loads(rv.data)['res_id']

        limit = self.real_app.config['RATELIMIT_QUOTA'] = 3

        def dummy():
            return ('', 204)

        with self.app.session_transaction() as client_sess:
            session_id = client_sess['session_id']

        with self.real_app.test_request_context():
            session['session_id'] = session_id
            for i in range(limit):
                self.assertEqual(ratelimit(dummy)(), ('', 204))

            self.assertEqual(ratelimit(dummy)()[1], 429)

    def test_ratelimit_no_session(self):
        def dummy():
            return ('', 204)

        with self.real_app.test_request_context():
            self.assertEqual(ratelimit(dummy)()[1], 401)


class DBCollectionTestCase(MongoWSTestCase):
    def setUp(self):
        super(DBCollectionTestCase, self).setUp()
        # Todo: For stuff that isn't checking authentication,
        # we probably don't want to rely on/use the authentication code
        rv = self.app.post('/mws/')
        response_dict = loads(rv.data)
        self.assertIn('res_id', response_dict)
        self.res_id = response_dict['res_id']
        self.assertIsNotNone(self.res_id)

        self.coll_name = 'test_collection'
        self.internal_coll_name = get_internal_coll_name(self.res_id,
                                                         self.coll_name)
        self.db = get_db()
        self.db_collection = self.db[self.internal_coll_name]

    def tearDown(self):
        super(DBCollectionTestCase, self).setUp()
        self.db_collection.drop()

    def _make_request(self, endpoint, data, method, expected_status):
        if data:
            data = dumps({k: v for k, v in data.iteritems() if v is not None})
        url = '/mws/%s/db/%s/%s' % (self.res_id, self.coll_name, endpoint)
        result = method(url, data=data, content_type='application/json')
        result_dict = loads(result.data)
        actual_status = result.status_code
        self.assertEqual(actual_status, expected_status,
                         "Expected request status to be %s, got %s instead" %
                         (expected_status, actual_status))
        return result_dict

    def make_find_request(self, query=None, projection=None,
                          expected_status=200):
        data = dumps({'query': query, 'projection': projection})
        return self._make_request('find?%s' % data, None, self.app.get,
                                  expected_status)

    def make_insert_request(self, document, expected_status=200):
        data = {'document': document}
        return self._make_request('insert', data, self.app.post,
                                  expected_status)

    def make_remove_request(self, constraint, just_one=False,
                            expected_status=200):
        data = {'constraint': constraint, 'just_one': just_one}
        self._make_request('remove', data, self.app.delete, expected_status)

    def make_update_request(self, query, update, upsert=False, multi=False,
                            expected_status=200):
        data = {
            'query': query,
            'update': update,
            'upsert': upsert,
            'multi': multi,
        }
        self._make_request('update', data, self.app.put, expected_status)

    def make_drop_request(self, expected_status=200):
        self._make_request('drop', None, self.app.delete, expected_status)

    def set_session_id(self, new_id):
        with self.app.session_transaction() as sess:
            sess['session_id'] = new_id


class FindUnitTestCase(DBCollectionTestCase):
    def test_find(self):
        query = {'name': 'mongo'}
        self.db_collection.insert(query)

        result = self.make_find_request(query)
        self.assertEqual(len(result), 1)
        self.assertEqual(result['result'][0]['name'], 'mongo')

    def test_invalid_find_session(self):
        self.set_session_id('invalid_id')
        document = {'name': 'mongo'}
        result = self.make_find_request(document, expected_status=403)
        error = {
            'error': 403,
            'reason': 'Session error. User does not have access to res_id',
            'detail': '',
        }
        self.assertEqual(result, error)


class InsertUnitTestCase(DBCollectionTestCase):
    def test_simple_insert(self):
        document = {'name': 'Mongo'}
        self.make_insert_request(document)

        result = self.db_collection.find()
        self.assertEqual(result.count(), 1)
        self.assertEqual(result[0]['name'], 'Mongo')

    def test_multiple_document_insert(self):
        document = [{'name': 'Mongo'}, {'name': '10gen'}]
        self.make_insert_request(document)

        result = self.db_collection.find()
        self.assertEqual(result.count(), 2)
        names = [r['name'] for r in result]
        self.assertItemsEqual(names, ['Mongo', '10gen'])

    def test_invalid_insert_session(self):
        self.set_session_id('invalid_session')
        document = {'name': 'mongo'}
        result = self.make_insert_request(document, expected_status=403)
        # See note above about brittle testing
        error = {
            'error': 403,
            'reason': 'Session error. User does not have access to res_id',
            'detail': '',
        }
        self.assertEqual(result, error)


class RemoveUnitTestCase(DBCollectionTestCase):
    def test_remove(self):
        self.db_collection.insert([
            {'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}
        ])

        document = {'name': 'Mongo'}
        self.make_remove_request(document)

        result = self.db_collection.find()
        self.assertEqual(result.count(), 1)
        self.assertEqual(result[0]['name'], 'NotMongo')

    def test_remove_one(self):
        self.db_collection.insert([
            {'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}
        ])

        document = {'name': 'Mongo'}
        self.make_remove_request(document, just_one=True)

        result = self.db_collection.find()
        names = [r['name'] for r in result]
        self.assertItemsEqual(names, ['Mongo', 'NotMongo'])

    def test_remove_requires_valid_res_id(self):
        self.set_session_id('invalid_session')
        self.make_remove_request({}, expected_status=403)


class UpdateUnitTestCase(DBCollectionTestCase):
    def test_upsert(self):
        result = self.db_collection.find({'name': 'Mongo'})
        self.assertEqual(result.count(), 0)

        self.make_update_request({}, {'name': 'Mongo'}, True)

        result = self.db_collection.find()
        self.assertEqual(result.count(), 1)
        self.assertEqual(result[0]['name'], 'Mongo')

    def test_update_one(self):
        self.db_collection.insert([
            {'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}
        ])
        self.make_update_request({'name': 'Mongo'}, {'name': 'Mongo2'}, True)

        result = self.db_collection.find()
        names = [r['name'] for r in result]
        self.assertItemsEqual(names, ['Mongo', 'Mongo2', 'NotMongo'])

    def test_update_multi(self):
        self.db_collection.insert([
            {'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}
        ])
        self.make_update_request(
            {'name': 'Mongo'},
            {'$set': {'name': 'Mongo2'}},
            False, True
        )

        result = self.db_collection.find()
        names = [r['name'] for r in result]
        self.assertItemsEqual(names, ['Mongo2', 'Mongo2', 'NotMongo'])

    def test_multi_upsert(self):
        # Does not exist - upsert
        self.make_update_request({}, {'$set': {'name': 'Mongo'}}, True, True)

        result = self.db_collection.find()
        self.assertEqual(result.count(), 1)
        self.assertEqual(result[0]['name'], 'Mongo')

        # Exists - multi-update
        self.db_collection.insert([{'name': 'Mongo'}, {'name': 'NotMongo'}])
        self.make_update_request(
            {'name': 'Mongo'},
            {'$set': {'name': 'Mongo2'}},
            True, True
        )

        result = self.db_collection.find()
        names = [r['name'] for r in result]
        self.assertItemsEqual(names, ['Mongo2', 'Mongo2', 'NotMongo'])


class DropUnitTestCase(DBCollectionTestCase):
    def test_drop(self):
        self.db_collection.insert([
            {'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}
        ])

        result = self.db_collection.find()
        self.assertEqual(result.count(), 3)

        self.make_drop_request()

        result = self.db_collection.find()
        self.assertEqual(result.count(), 0)

        self.assertNotIn(self.internal_coll_name, self.db.collection_names())


class IntegrationTestCase(DBCollectionTestCase):
    def test_insert_find(self):
        document = {'name': 'mongo'}
        self.make_insert_request(document)

        result = self.make_find_request(document)
        self.assertDictContainsSubset(document, result['result'][0])
