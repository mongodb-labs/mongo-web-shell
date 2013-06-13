from apscheduler.scheduler import Scheduler
from mws.db import get_db
import logging
from datetime import datetime, timedelta
import traceback
from mws.util import get_internal_coll_name

EXPIRE_SESSION_EVERY = 600
EXPIRE_SESSION_DURATION = 1800

def run_scheduler(app):
    scheduler = Scheduler()

    @scheduler.interval_schedule(seconds=EXPIRE_SESSION_EVERY)
    def expire_sessions():
        with app.app_context():
            db = get_db()
            expiration = datetime.now() - timedelta(seconds=EXPIRE_SESSION_DURATION)
            sessions = db.clients.find({'timestamp': {'$lt': expiration}})
            for sess in sessions:
                db.clients.remove(sess)
                for c in sess['collections']:
                    db.drop_collection(get_internal_coll_name(sess['res_id'], c))
            app.logger.info('Timed out expired sessions dead before ' + str(expiration))

    scheduler.start()
    print "APScheduler started successfully"
