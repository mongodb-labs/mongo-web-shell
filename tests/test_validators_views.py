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

import types
import mock
import sys
from tests import MongoWSTestCase
from mongows.validators.ValidationTest import ValidationTest


class ValidatorsTestCase(MongoWSTestCase):
    def test_imports_and_runs_the_specified_file(self):
        # Create module test_script in scripts
        test_script = types.ModuleType('test_script')
        run_mock = mock.MagicMock()

        class ValidationTestCase(ValidationTest):
            def run(self):
                run_mock(self.res_id)
                return 'ok', 200

        test_script.__dict__.update({'ValidationTestCase': ValidationTestCase})
        sys.modules['mongows.validators.scripts.test_script'] = test_script

        response = self.app.post('/validate/test_script',
                                 data={'res_id': 'foo'})

        self.assertEqual(response.data, 'ok')
        self.assertEqual(response.status_code, 200)
        run_mock.assert_called_once_with('foo')
        del sys.modules['mongows.validators.scripts.test_script']

    def test_returns_404_when_accessing_nonexistent_script(self):
        response = self.app.post('/validate/test_script',
                                 data={'res_id': 'foo'})

        expected_message = 'Unknown validation script test_script'
        self.assertEqual(response.data, expected_message)
        self.assertEqual(response.status_code, 404)
