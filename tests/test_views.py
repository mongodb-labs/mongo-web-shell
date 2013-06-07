import json

from tests import MongoWSTestCase


class ViewsSetUpUnitTestCase(MongoWSTestCase):
    def setUp(self):
        super(ViewsSetUpUnitTestCase, self).setUp()

    def tearDown(self):
        super(ViewsSetUpUnitTestCase, self).tearDown()

    def test_create_mws_resource(self):
        url = '/mws/'
        rv = self.app.post(url)
        response_dict = json.loads(rv.data)
        self.assertIn('res_id', response_dict)
        res_id = response_dict['res_id']
        self.assertIsNotNone(res_id)

        # check if res_id is unchanged
        rv = self.app.post(url)
        new_res_id = json.loads(rv.data)['res_id']
        self.assertIsNotNone(new_res_id)
        self.assertEqual(res_id, new_res_id)

    def test_create_mws_resource_new_session(self):
        url = '/mws/'
        rv = self.app.post(url)
        response_dict = json.loads(rv.data)
        self.assertIn('res_id', response_dict)
        res_id = response_dict['res_id']
        self.assertIsNotNone(res_id)

        with self.app.session_transaction() as sess:
            del sess['session_id']

        # check if res_id is unique
        rv = self.app.post(url)
        new_res_id = json.loads(rv.data)['res_id']
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
        rv = self.app.post('/mws/')
        response_dict = json.loads(rv.data)
        self.assertIn('res_id', response_dict)
        self.res_id = response_dict['res_id']
        self.assertIsNotNone(self.res_id)

    def tearDown(self):
        super(DBCollectionTestCase, self).tearDown()

    def _make_request(self, collection, endpoint, data, method, expected_status, return_result=True):
        url = '/mws/%s/db/%s/%s' % (self.res_id, collection, endpoint)
        result = method(url, data=data, content_type='application/json')
        result_dict = json.loads(result.data)
        actual_status = result_dict['status']
        self.assertEqual(actual_status, expected_status,
                         "Expected request status to be %s, got %s instead" % (expected_status, actual_status))
        if return_result:
            return result_dict['result']
        else:
            return None

    def make_find_request(self, collection, query=None, projection=None, expected_status=0):
        data = {}
        if query:
            data['query'] = query
        if projection:
            data['projection'] = projection
        data = json.dumps(data)
        return self._make_request(collection, 'find', data, self.app.get, expected_status)

    def make_insert_request(self, collection, document, expected_status=0):
        data = json.dumps({'document': document})
        return self._make_request(collection, 'insert', data, self.app.post, expected_status)

    def make_remove_request(self, collection, constraint, justOne=False, expected_status=0):
        data = json.dumps({'constraint': constraint, 'justOne': justOne})
        self._make_request(collection, 'remove', data, self.app.delete, expected_status, return_result=False)

    def set_session_id(self, new_id):
        with self.app.session_transaction() as sess:
            sess['session_id'] = new_id


class ViewsFindUnitTestCase(DBCollectionTestCase):
    def test_find(self):
        query = {'name': 'mongo'}
        # Todo: Actually test find. This doesn't really test any functionality right now
        self.make_find_request('test_collection', query, expected_status=0)

    def test_invalid_find_session(self):
        self.set_session_id('invalid_id')
        document = {'name': 'mongo'}
        result = self.make_find_request('test_collection', document, expected_status=-1)
        # Todo: Seems like brittle, declarative testing. Would be great if
        # we could verify the type of error without testing against the error
        # string itself, maybe by using a different status.
        error = 'Session error. User does not have access to res_id'
        self.assertEqual(result, error)


class ViewsInsertUnitTestCase(DBCollectionTestCase):
    def test_db_collection_simple_insert(self):
        document = {'name': 'Mongo'}
        result = self.make_insert_request('test_collection', document)
        self.assertIn('$oid', result)

    def test_multiple_document_insert(self):
        document = [{'name': 'Mongo'}, {'name': '10gen'}]
        result = self.make_insert_request('test_collection', document)
        self.assertEqual(len(result), 2)
        self.assertIn('$oid', result[0])

    def test_invalid_insert_session(self):
        self.set_session_id('invalid_session')
        document = {'name': 'mongo'}
        result = self.make_insert_request('test_collection', document, expected_status=-1)
        # See note above about brittle testing
        error = 'Session error. User does not have access to res_id'
        self.assertEqual(result, error)


class ViewsRemoveUnitTestCase(DBCollectionTestCase):
    def test_db_collection_remove(self):
        document = [{'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}]
        result = self.make_insert_request('test_collection', document)
        self.assertEqual(len(result), 3)
        self.assertIn('$oid', result[0])

        document = {'name': 'Mongo'}
        self.make_remove_request('test_collection', document)

        result = self.make_find_request('test_collection', {})
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['name'], 'NotMongo')

    def test_db_collection_removeOne(self):
        document = [{'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}]
        result = self.make_insert_request('test_collection', document)
        self.assertEqual(len(result), 3)
        self.assertIn('$oid', result[0])

        document = {'name': 'Mongo'}
        self.make_remove_request('test_collection', document, justOne=True)

        result = self.make_find_request('test_collection', {})
        # self.assertEqual(len(result), 2)
        names = [r['name'] for r in result]
        self.assertItemsEqual(names, ['Mongo', 'NotMongo'])


class ViewsIntegrationTestCase(DBCollectionTestCase):
    def test_insert_find(self):
        document = {'name': 'mongo'}
        result = self.make_insert_request('test_collection', document)
        self.assertIn('$oid', result)

        result = self.make_find_request('test_collection', document)
        self.assertDictContainsSubset(document, result[0])
