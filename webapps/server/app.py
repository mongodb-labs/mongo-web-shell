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

from webapps.lib.log import configure_logging
from webapps.server.views import mws

from webapps.lib.conf import update_config

_logger = logging.getLogger(__name__)

_here = os.path.dirname(os.path.abspath(__file__))
_testing = 'MWS_SERVER_TESTING' in os.environ
_devel = os.path.exists(os.path.join(_here, 'devel'))
_staging = os.path.exists(os.path.join(_here, 'staging'))
_prod = os.path.exists(os.path.join(_here, 'prod'))

if _testing:
    environment = "test"
elif _devel:
    environment = "devel"
elif _staging:
    environment = "staging"
elif _prod:
    environment = "prod"

def create_app():
    app = Flask(__name__)
    app.config.from_object('webapps.configs.server')
    # Overrides the config with any environment variables that might
    # be set
    update_config(app, 'SERVER')
    configure_logging(app, environment)
    app.register_blueprint(mws)
    return app


app = application = create_app()


if __name__ == '__main__':
    app.run()
