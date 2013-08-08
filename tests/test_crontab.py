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

from datetime import datetime, timedelta
import mock
from mongows import crontab
from mongows.crontab import run_scheduler, EXPIRE_SESSION_EVERY
from mongows.mws.db import get_db
from mongows.mws.util import get_internal_coll_name
from tests import MongoWSTestCase


class ExpireSessionsTestCase(MongoWSTestCase):
    def setUp(self):
        super(ExpireSessionsTestCase, self).setUp()
        self.context = self.real_app.app_context()
        self.context.push()
        self.db = get_db()

        # All test data should be before this date
        # We can assume we don't have any real data before this date
        self.test_before_date = datetime(2012, 7, 6)
        self.db.clients.remove({'timestamp': {'$lt': self.test_before_date}})

    def tearDown(self):
        super(ExpireSessionsTestCase, self).tearDown()
        # Remove test entries from db
        self.db.clients.remove({'timestamp': {'$lt': self.test_before_date}})
        self.context.pop()

    @mock.patch('mongows.crontab.datetime')
    def test_removes_old_sessions_and_associated_collections(self,
                                                             datetime_mock):
        dates = [
            datetime(2012, 7, 2),
            datetime(2012, 7, 3),
            datetime(2012, 7, 4),
            datetime(2012, 7, 5),
        ]
        for session_res_id, date in enumerate(dates):
            collections = []
            for collection in xrange(3):
                collections.append(collection)
                collection_name = get_internal_coll_name(session_res_id,
                                                         collection)
                self.db[collection_name].insert({'foo': 'barr'})

            self.db.clients.insert({
                'session_id': session_res_id,
                'res_id': session_res_id,
                'collections': collections,
                'timestamp': date,
            })

        # Want to get rid of everything before 2012/7/4
        delta = timedelta(seconds=crontab.EXPIRE_SESSION_DURATION)
        datetime_mock.now.return_value = datetime(2012, 7, 4) - delta

        crontab.expire_sessions(self.real_app)

        # Should grab all remaining records we inserted
        res = self.db.clients.find({
            'timestamp': {'$lt': self.test_before_date}
        })
        self.assertEqual(res.count(), 2)
        actual_dates = [r['timestamp'] for r in res]
        expected_dates = dates[-2:]  # Only the last two should survive
        self.assertItemsEqual(actual_dates, expected_dates)

        # Make sure collections were dropped
        coll_names = self.db.collection_names()
        self.assertNotIn('00', coll_names)
        self.assertNotIn('01', coll_names)
        self.assertNotIn('02', coll_names)
        self.assertNotIn('10', coll_names)
        self.assertNotIn('11', coll_names)
        self.assertNotIn('12', coll_names)

        self.assertIn('20', coll_names)
        self.assertIn('21', coll_names)
        self.assertIn('22', coll_names)
        self.assertIn('30', coll_names)
        self.assertIn('31', coll_names)
        self.assertIn('32', coll_names)

        for name in ['20', '21', '22', '30', '31', '32']:
            self.db[name].drop()

    @mock.patch('mongows.crontab.Scheduler')
    @mock.patch('mongows.crontab.expire_sessions')
    def test_run_scheduler_starts_expire_sessions_job(self,
                                                      expire_sessions_mock,
                                                      scheduler_cls_mock):
        scheduler_mock = mock.MagicMock()
        scheduler_cls_mock.return_value = scheduler_mock

        run_scheduler(mock.sentinel.app)

        self.assertTrue(scheduler_mock.add_interval_job.called)
        args = scheduler_mock.add_interval_job.call_args
        self.assertEqual(len(args[0]), 1)
        self.assertEqual(len(args[1]), 1)
        func = args[0][0]
        secs = args[1]['seconds']

        func()
        expire_sessions_mock.assert_called_with(mock.sentinel.app)
        self.assertEqual(secs, EXPIRE_SESSION_EVERY)
