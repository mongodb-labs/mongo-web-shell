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

import mock
from run import main
from tests import MongoWSTestCase


class InitialLoaderTestCase(MongoWSTestCase):
    @mock.patch('run.run_scheduler')
    @mock.patch('run.create_app')
    @mock.patch('run.ensure_indices')
    def test_runs_setup_functions(
            self, run_scheduler_mock, app_mock, ensure_indices_mock):
        created_app = mock.MagicMock()
        host = mock.sentinel.host
        port = mock.sentinel.port
        created_app.config = {'HOST': host, 'PORT': port}
        app_mock.return_value = created_app

        main()

        run_scheduler_mock.assert_called_with(created_app)
        ensure_indices_mock.assert_called_with(created_app)
        created_app.run.assert_called_with(host=host, port=port)
