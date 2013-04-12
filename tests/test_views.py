import unittest

from mongows import views
from tests import MongoWSTestCase

class ViewsTestCase(MongoWSTestCase):

    def test_hello(self):
        rv = self.app.get('/')
        self.assertTrue('Hello World!' in rv.data)

    def test_create_mws_resource(self):
        url = '/mws'
        rv = self.app.post(url)
        self.assertTrue('Not yet implemented' in rv.data)

    def test_keep_mws_alive(self):
        url = '/mws/res_id/keep-alive'
        rv = self.app.post(url)
        self.assertTrue('Not yet implemented' in rv.data)

    def test_db_collection_find(self):
        url = '/mws/res_id/db/collection_name/find'
        rv = self.app.get(url)
        self.assertTrue('Not yet implemented' in rv.data)

    def test_db_collection_insert(self):
        url = '/mws/res_id/db/collection_name/insert'
        rv = self.app.post(url)
        self.assertTrue('Not yet implemented' in rv.data)
