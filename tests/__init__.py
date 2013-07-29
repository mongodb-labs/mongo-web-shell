#    Copyright 2013 10gen Inc.
#
#    Licensed under the Apache License, Version 2.0 (the "License");
#    you may not use this file except in compliance with the License.
#    You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
#    Unless required by applicable law or agreed to in writing, software
#    distributed under the License is distributed on an "AS IS" BASIS,
#    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#    See the License for the specific language governing permissions and
#    limitations under the License.

from unittest import defaultTestLoader, TestCase

from mongows import create_app

app = create_app()
app.testing = True
app.config['QUOTA_NUM_COLLECTIONS'] = None


class MongoWSTestCase(TestCase):
    """A generic test case for the mongows package."""

    def setUp(self):
        self.real_app = app
        self.app = app.test_client()

    def tearDown(self):
        pass


def load_tests(loader, tests, pattern):
    """Returns the test modules for the mongows package.

    The expected output of this function is defined by the unittest module's
    load_tests protocol. unittest.main() will runs tests on the modules
    returned by this function.

    """
    return defaultTestLoader.discover(__name__)
