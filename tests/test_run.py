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
