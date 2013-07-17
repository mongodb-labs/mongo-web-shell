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

from mongows import create_app
from mongows.crontab import run_scheduler
from mongows.mws.db import get_db


def ensure_indices(app):
    with app.app_context():
        db = get_db()
        db.ratelimit.ensure_index([('session_id', 1), ('timestamp', 1)])
        db.ratelimit.ensure_index('timestamp',
                                  background=True,
                                  expireAfterSeconds=60)


def main():
    global app, host, port
    app = create_app()
    host, port = app.config['HOST'], app.config['PORT']
    run_scheduler(app)
    ensure_indices(app)
    app.run(host=host, port=port)


if __name__ == '__main__':
    main()
