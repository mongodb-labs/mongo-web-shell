import types
import mock
import sys
from tests import MongoWSTestCase


class InitializersTestCase(MongoWSTestCase):
    def test_imports_and_runs_the_specified_file(self):
        # Create module test_script in scripts
        test_script = types.ModuleType('test_script')
        run_mock = mock.MagicMock()
        test_script.__dict__.update({'run': run_mock})
        sys.modules['mongows.initializers.scripts.test_script'] = test_script

        response = self.app.post('/init/test_script', data={'res_id': 'foo'})

        run_mock.assert_called_once_with('foo')
        self.assertEqual(response.data, 'ok')
        self.assertEqual(response.status_code, 200)
        del sys.modules['mongows.initializers.scripts.test_script']

    def test_returns_404_when_accessing_nonexistent_script(self):
        response = self.app.post('/init/test_script', data={'res_id': 'foo'})

        expected_message = 'Unknown initialization script test_script'
        self.assertEqual(response.data, expected_message)
        self.assertEqual(response.status_code, 404)
