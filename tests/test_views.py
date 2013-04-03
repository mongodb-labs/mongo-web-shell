import unittest

from mongows import views
from tests import MongowsTestCase

class ViewsTestCase(MongowsTestCase):

    def test_hello(self):
        rv = views.hello()
        self.assertTrue('Hello World!' in rv)
