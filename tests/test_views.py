import json
import unittest

from mongows import views
from tests import MongoWSTestCase

class ViewsTestCase(MongoWSTestCase):
    def setUp(self):
        # We should create a test database here.
        self.app = views.app.test_client()

    def tearDown(self):
        # Drop the test database here.
        pass

    def test_create_mws_resource(self):
        url = '/mws'
        rv = self.app.post(url)
        self.assertTrue('{"res_id": "test"}' in rv.data)

    def test_keep_mws_alive(self):
        url = '/mws/res_id/keep-alive'
        rv = self.app.post(url)
        self.assertTrue('{}' in rv.data)

    def db_collection_find(self, res_id, collection, query=None, projection=None):
        url = '/mws/' + res_id +'/db/' + collection + '/find'
        data = json.dumps({'query': query, 'projection': projection})
        return self.app.get(url, data=data, content_type='application/json')

    def db_collection_insert(self, res_id, collection, document):
        url = '/mws/' + res_id +'/db/' + collection + '/insert'
        data = json.dumps({'document': document})
        return self.app.post(url, data=data, content_type='application/json')

    def test_insert_find(self):
        # TODO: After we start dropping the db after running testcases through
        # the tearDown method, for each run of the test cases, we would have
        # a clean db and we can write more specific tests cases in that case.
        # Currently, I am just looking for presence of OBJECT_ID in the
        # return value of each call.
        document = {'name': 'Mongo'}
        rv = self.db_collection_insert("test_db", "test_collection", document)
        self.assertTrue('$oid' in rv.data)

        rv = self.db_collection_find("test_db", "test_collection", document)
        self.assertTrue('$oid' in rv.data)
