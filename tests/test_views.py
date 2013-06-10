import json
import unittest

from mongows.mws import views
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

class ViewsFindUnitTestCase(MongoWSTestCase):
    def setUp(self):
        super(ViewsFindUnitTestCase, self).setUp()
        rv = self.app.post('/mws/')
        response_dict = json.loads(rv.data)
        self.assertIn('res_id', response_dict)
        self.res_id = response_dict['res_id']

    def tearDown(self):
        super(ViewsFindUnitTestCase, self).tearDown()

    def test_find(self):
        self.assertIsNotNone(self.res_id)
        document = {'name': 'mongo'}
        rv = _make_find_request(self.app, self.res_id, 'test_collection',
                                document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)

    def test_invalid_find_session(self):
        self.assertIsNotNone(self.res_id)
        with self.app.session_transaction() as sess:
            sess['session_id'] = 'value'
        document = {'name': 'mongo'}
        rv = _make_find_request(self.app, self.res_id, 'test_collection',
                                document)
        json_rv_data = json.loads(rv.data)
        error = 'Session error. User does not have access to res_id'
        self.assertEqual(json_rv_data['status'], -1)
        self.assertEqual(json_rv_data['result'], error)


class ViewsInsertUnitTestCase(MongoWSTestCase):
    def setUp(self):
        super(ViewsInsertUnitTestCase, self).setUp()
        rv = self.app.post('/mws/')
        response_dict = json.loads(rv.data)
        self.assertIn('res_id', response_dict)
        self.res_id = response_dict['res_id']

    def tearDown(self):
        super(ViewsInsertUnitTestCase, self).tearDown()

    def test_db_collection_simple_insert(self):
        self.assertIsNotNone(self.res_id)
        document = {'name': 'Mongo'}
        rv = _make_insert_request(self.app, self.res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)
        self.assertIn('$oid', json_rv_data['result'])

    def test_multiple_document_insert(self):
        self.assertIsNotNone(self.res_id)
        document = [{'name': 'Mongo'}, {'name': '10gen'}]
        rv = _make_insert_request(self.app, self.res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)
        self.assertEqual(len(json_rv_data['result']), 2)
        self.assertIn('$oid', json_rv_data['result'][0])

    def test_invalid_insert_session(self):
        self.assertIsNotNone(self.res_id)
        with self.app.session_transaction() as sess:
            sess['session_id'] = 'value'
        document = {'name': 'mongo'}
        rv = _make_insert_request(self.app, self.res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        error = 'Session error. User does not have access to res_id'
        self.assertEqual(json_rv_data['status'], -1)
        self.assertEqual(json_rv_data['result'], error)

class ViewsRemoveUnitTestCase(MongoWSTestCase):
    def setUp(self):
        super(ViewsRemoveUnitTestCase, self).setUp()
        rv = self.app.post('/mws/')
        response_dict = json.loads(rv.data)
        self.assertIn('res_id', response_dict)
        self.res_id = response_dict['res_id']

    def tearDown(self):
        super(ViewsRemoveUnitTestCase, self).tearDown()

    def test_db_collection_remove(self):
        document = [{'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}]
        rv = _make_insert_request(self.app, self.res_id, 'test_collection',
                                  document)

        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)
        self.assertEqual(len(json_rv_data['result']), 3)
        self.assertIn('$oid', json_rv_data['result'][0])

        document = {'name': 'Mongo'}
        rv = _make_remove_request(self.app, self.res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)

        rv = _make_find_request(self.app, self.res_id, 'test_collection', {})
        json_rv_data = json.loads(rv.data)
        self.assertEqual(len(json_rv_data['result']), 1)
        self.assertEqual(json_rv_data['result'][0]['name'], 'NotMongo')

    def test_db_collection_remove_one(self):
        document = [{'name': 'Mongo'}, {'name': 'Mongo'}, {'name': 'NotMongo'}]
        rv = _make_insert_request(self.app, self.res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)
        self.assertEqual(len(json_rv_data['result']), 3)
        self.assertIn('$oid', json_rv_data['result'][0])

        document = {'name': 'Mongo'}
        rv = _make_remove_request(self.app, self.res_id, 'test_collection',
                                  document, True)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)

        rv = _make_find_request(self.app, self.res_id, 'test_collection', {})
        json_rv_data = json.loads(rv.data)
        self.assertEqual(len(json_rv_data['result']), 2)

        names = [x['name'] for x in json_rv_data['result']]
        self.assertItemsEqual(names, ['Mongo', 'NotMongo'])

class ViewsIntegrationTestCase(MongoWSTestCase):
    def setUp(self):
        super(ViewsIntegrationTestCase, self).setUp()
        rv = self.app.post('/mws/')
        response_dict = json.loads(rv.data)
        self.assertIn('res_id', response_dict)
        self.res_id = response_dict['res_id']

    def tearDown(self):
        super(ViewsIntegrationTestCase, self).tearDown()

    def test_insert_find(self):
        self.assertIsNotNone(self.res_id)
        document = {'name': 'mongo'}
        rv = _make_insert_request(self.app, self.res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)
        self.assertIn('$oid', json_rv_data['result'])
        rv = _make_find_request(self.app, self.res_id, 'test_collection',
                                document)
        json_rv_data = json.loads(rv.data)
        query_results = json_rv_data['result'][0]
        self.assertEqual(json_rv_data['status'], 0)
        self.assertDictContainsSubset(document, query_results)


def _make_find_request(app, res_id, collection, query=None, projection=None):
    # TODO: Should we be passing in None for query and projection here? The
    # frontend should never pass 'None' so it might be incorrect.
    url = '/mws/' + res_id + '/db/' + collection + '/find'
    data = json.dumps({'query': query, 'projection': projection})
    return app.get(url, data=data, content_type='application/json')


def _make_insert_request(app, res_id, collection, document):
    url = '/mws/' + res_id + '/db/' + collection + '/insert'
    data = json.dumps({'document': document})
    return app.post(url, data=data, content_type='application/json')

def _make_remove_request(app, res_id, collection, constraint, justOne=False):
    url = '/mws/' + res_id + '/db/' + collection + '/remove'
    data = json.dumps({'constraint': constraint, 'justOne': justOne})
    return app.delete(url, data=data, content_type='application/json')
