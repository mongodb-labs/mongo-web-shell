from unittest import defaultTestLoader, TestCase

class MongowsTestCase(TestCase):
    """A generic test case for the mongows package."""

    def setUp(self):
        pass

    def tearDown(self):
        pass

def load_tests(loader, tests, pattern):
    """Returns the test modules for the mongows package.

    The expected output of this function is defined by the unittest module's
    load_tests protocol. unittest.main() will runs tests on the modules
    returned by this function.

    """
    return defaultTestLoader.discover(__name__)
