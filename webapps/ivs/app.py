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

from flask import Flask

from webapps.lib.log import configure_logging
from webapps.lib.conf import update_config

from webapps.ivs.views import ivs

import logging
_logger = logging.getLogger(__name__)


def create_app():
    app = Flask(__name__)
    app.config.from_object('webapps.configs.ivs')
    # Overrides the config with any environment variables that might
    # be set
    update_config(app, 'IVS')
    configure_logging(app)
    _logger.info('test')
    app.register_blueprint(ivs)
    return app


app = create_app()
