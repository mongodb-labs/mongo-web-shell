import json
import unittest

from mongows.mws import views
from tests import MongoWSTestCase


class ViewsUnitTestCase(MongoWSTestCase):
    def setUp(self):
        super(ViewsUnitTestCase, self).setUp()

    def tearDown(self):
        super(ViewsUnitTestCase, self).tearDown()

    def test_create_mws_resource(self):
        # TODO: Once we have finalized the behavior of creating MWS resource,
        # this test case should be improved to make the JSON object of the
        # returned value to check for appropriate contents
        url = '/mws/'
        rv = self.app.post(url)
        response_dict = json.loads(rv.data)
        res_id = response_dict['res_id']
        self.assertIsNotNone(res_id)

    def test_keep_mws_alive(self):
        # After this method is completed we should test it better
        url = '/mws/res_id/keep-alive'
        rv = self.app.post(url)
        self.assertIn('{}', rv.data)

    def test_db_collection_simple_insert(self):
        # TODO: Make sure these rows are deleted in the tearDown
        rv = self.app.post('/mws/')
        res_id = json.loads(rv.data)['res_id']
        self.assertIsNotNone(res_id)
        document = {'name': 'Mongo'}
        rv = _make_insert_request(self.app, res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)
        self.assertIn('$oid', json_rv_data['result'])

    def test_multiple_document_insert(self):
        rv = self.app.post('/mws/')
        res_id = json.loads(rv.data)['res_id']
        self.assertIsNotNone(res_id)
        document = [{'name': 'Mongo'}, {'name': '10gen'}]
        rv = _make_insert_request(self.app, res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)
        self.assertEqual(len(json_rv_data['result']), 2)
        self.assertIn('$oid', json_rv_data['result'][0])

    def test_invalid_insert_session(self):
        rv = self.app.post('/mws/')
        res_id = json.loads(rv.data)['res_id']
        self.assertIsNotNone(res_id)
        with self.app.session_transaction() as sess:
                sess['session_id'] = 'value'
        key = 'name'
        value = 'mongo'
        document = {key: value}
        rv = _make_insert_request(self.app, res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        error = 'Session error. User does not have access to res_id'
        self.assertEqual(json_rv_data['status'], -1)
        self.assertEqual(json_rv_data['result'], error)

    def test_invalid_find_session(self):
        rv = self.app.post('/mws/')
        res_id = json.loads(rv.data)['res_id']
        self.assertIsNotNone(res_id)
        with self.app.session_transaction() as sess:
                sess['session_id'] = 'value'
        key = 'name'
        value = 'mongo'
        document = {key: value}
        rv = _make_find_request(self.app, res_id, 'test_collection',
                                document)
        json_rv_data = json.loads(rv.data)
        error = 'Session error. User does not have access to res_id'
        self.assertEqual(json_rv_data['status'], -1)
        self.assertEqual(json_rv_data['result'], error)

class ViewsIntegrationTestCase(MongoWSTestCase):
    def setUp(self):
        super(ViewsIntegrationTestCase, self).setUp()

    def tearDown(self):
        super(ViewsIntegrationTestCase, self).tearDown()

    def test_insert_find(self):
        rv = self.app.post('/mws/')
        res_id = json.loads(rv.data)['res_id']
        self.assertIsNotNone(res_id)
        key = 'name'
        value = 'mongo'
        document = {key: value}
        rv = _make_insert_request(self.app, res_id, 'test_collection',
                                  document)
        json_rv_data = json.loads(rv.data)
        self.assertEqual(json_rv_data['status'], 0)
        self.assertIn('$oid', json_rv_data['result'])

        rv = _make_find_request(self.app, res_id, 'test_collection',
                                document)
        json_rv_data = json.loads(rv.data)
        query_results = json_rv_data['result'][0]
        self.assertEqual(json_rv_data['status'], 0)
        self.assertEqual(query_results[key], value)


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
