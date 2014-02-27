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

import os
from flask import Flask
import logging

from webapps.lib.conf import update_config
from webapps.lib.log import configure_logging
from webapps.lib.util import get_environment
from webapps.server import crontab
from webapps.server.views import mws


_logger = logging.getLogger(__name__)


if 'MWS_SERVER_TESTING' in os.environ:
    environment = 'test'
else:
    _here = os.path.dirname(os.path.abspath(__file__))
    environment = get_environment(_here)


def create_app():
    app = Flask(__name__)
    app.config.from_object('webapps.configs.server')
    # Overrides the config with any environment variables that might
    # be set
    update_config(app, 'SERVER', environment)
    configure_logging(app, environment)
    app.register_blueprint(mws)
    crontab.run_scheduler(app)
    return app


app = application = create_app()


if __name__ == '__main__':
    app.run()
