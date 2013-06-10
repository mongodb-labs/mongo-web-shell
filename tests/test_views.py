from bson.json_util import loads, dumps
from mongows.mws.db import get_db
from mongows.mws.views import get_internal_collection_name

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

    def test_keep_mws_alive(self):
        # TODO: After this method is completed we should test it better
        url = '/mws/res_id/keep-alive'
        rv = self.app.post(url)
        self.assertIn('{}', rv.data)


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
        
        self.collection_name = 'test_collection'
        internal_collection_name = get_internal_collection_name(self.res_id, self.collection_name)
        self.db_collection = get_db()[internal_collection_name]
        
    def tearDown(self):
        super(DBCollectionTestCase, self).setUp()
        self.db_collection.drop()
        
    def _make_request(self, endpoint, data, method, expected_status, require_result=True):
        data = dumps({k: v for k, v in data.iteritems() if v})
        url = '/mws/%s/db/%s/%s' % (self.res_id, self.collection_name, endpoint)
        result = method(url, data=data, content_type='application/json')
        result_dict = loads(result.data)
        actual_status = result_dict['status']
        self.assertEqual(actual_status, expected_status,
                         "Expected request status to be %s, got %s instead" % (expected_status, actual_status))
        try:
            return result_dict['result']
        except KeyError:
            if not require_result:
                return None
            raise

    def make_find_request(self, query=None, projection=None, expected_status=0):
        data = {'query': query, 'projection': projection}
        return self._make_request('find', data, self.app.get, expected_status)

    def make_insert_request(self, document, expected_status=0):
        data = {'document': document}
        return self._make_request('insert', data, self.app.post, expected_status, require_result=False)

    def make_remove_request(self, constraint, just_one=False, expected_status=0):
        data = {'constraint': constraint, 'just_one': just_one}
        self._make_request('remove', data, self.app.delete, expected_status, require_result=False)

    def set_session_id(self, new_id):
        with self.app.session_transaction() as sess:
            sess['session_id'] = new_id


class FindUnitTestCase(DBCollectionTestCase):
    def test_find(self):
        query = {'name': 'mongo'}
        self.db_collection.insert(query)

        result = self.make_find_request(query)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['name'], 'mongo')

    def test_invalid_find_session(self):
        self.set_session_id('invalid_id')
        document = {'name': 'mongo'}
        result = self.make_find_request(document, expected_status=-1)
        # Todo: Seems like brittle, declarative testing. Would be great if
        # we could verify the type of error without testing against the error
        # string itself, maybe by using a different status.
        error = 'Session error. User does not have access to res_id'
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
        result = self.make_insert_request(document, expected_status=-1)
        # See note above about brittle testing
        error = 'Session error. User does not have access to res_id'
        self.assertEqual(result, error)


class RemoveUnitTestCase(DBCollectionTestCase):
    def test_remove(self):
        self.db_collection.insert([{'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}])

        document = {'name': 'Mongo'}
        self.make_remove_request(document)

        result = self.db_collection.find()
        self.assertEqual(result.count(), 1)
        self.assertEqual(result[0]['name'], 'NotMongo')

    def test_remove_one(self):
        self.db_collection.insert([{'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}])

        document = {'name': 'Mongo'}
        self.make_remove_request(document, just_one=True)

        result = self.db_collection.find()
        names = [r['name'] for r in result]
        self.assertItemsEqual(names, ['Mongo', 'NotMongo'])

    def test_remove_requires_valid_res_id(self):
        self.set_session_id('invalid_session')
        self.make_remove_request({}, expected_status=-1)


class IntegrationTestCase(DBCollectionTestCase):
    def test_insert_find(self):
        document = {'name': 'mongo'}
        self.make_insert_request(document)

        result = self.make_find_request(document)
        self.assertDictContainsSubset(document, result[0])
