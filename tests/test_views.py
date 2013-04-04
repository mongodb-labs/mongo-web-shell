import unittest

from mongows import views
from tests import MongoWSTestCase

class ViewsTestCase(MongoWSTestCase):

    def test_hello(self):
        rv = self.app.get('/')
        self.assertTrue('Hello World!' in rv.data)
