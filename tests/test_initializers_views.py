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
from bson.json_util import dumps
import mock
import sys
from tests import MongoWSTestCase


class InitializersTestCase(MongoWSTestCase):
    def create_test_script(self):
        # Create module test_script in scripts
        test_script = types.ModuleType('test_script')
        run_mock = mock.MagicMock()
        test_script.__dict__.update({'run': run_mock})
        sys.modules['mongows.initializers.scripts.test_script'] = test_script
        return run_mock

    def make_init_request(self, script_name, data=None):
        if data is None:
            data = {'res_id': 'test_res_id'}
        return self.app.post('/init/%s' % script_name, data=dumps(data),
                             content_type='application/json')

    def test_imports_and_runs_the_specified_file(self):
        run_mock = self.create_test_script()

        response = self.make_init_request('test_script', {'res_id': 'foo'})

        run_mock.assert_called_once_with('foo')
        self.assertEqual(response.data, 'ok')
        self.assertEqual(response.status_code, 200)
        del sys.modules['mongows.initializers.scripts.test_script']

    def test_returns_404_when_accessing_nonexistent_script(self):
        response = self.make_init_request('does_not_exist')

        expected_message = 'Unknown initialization script does_not_exist'
        self.assertEqual(response.data, expected_message)
        self.assertEqual(response.status_code, 404)

    def test_passes_parsed_json_when_there_are_extra_keys(self):
        data = {
            'res_id': 'my_res_id',
            'extra_data': {'my': 'data'}
        }
        run_mock = self.create_test_script()

        self.make_init_request('test_script', data)
        run_mock.assert_called_once_with('my_res_id', data)
