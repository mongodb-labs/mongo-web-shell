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
import yaml
# The environment variable name and the key in app.config[key].
_ENVVAR = [
    ('ADMIN_EMAILS', str),
    ('DEBUG', bool),
    ('DB_HOSTS', list)
]
_PREFIXED_ENVVAR = [
    # Web Shell server
    ('SERVER_HOST', str),
    ('SERVER_PORT', int),
    # Init Verification service
    ('IVS_EDX_SHARED_KEY', str),
    ('IVS_GRADING_SERVER_URL', str),
    ('IVS_GRADING_API_KEY', str),
    ('IVS_GRADING_API_SECRET', str),
    ('IVS_DATA_DIR', str),
    ('IVS_HOST', str),
    ('IVS_PORT', int),
]

config_location_map = {
    'staging': '/opt/10gen/trymongo-staging/shared/config.yml',
    'prod':  '/opt/10gen/trymongo-prod/shared/config.yml'
}


def update_config(app, prefix, environment):
    """Overrides the flask app's configuration with envvar where applicable."""
    config = {}
    if 'CONFIG_FILENAME' in os.environ:
        path = os.environ.get('CONFIG_FILENAME')
        try:
            _config_file = open(path, 'r')
            config = yaml.load(_config_file)
        except IOError as e:
                print("Expected to find a file at {0}, proceeding without, relative to {1}".format(path, os.getcwd()))
    else:
        try:
            full_path = os.path.abspath(config_location_map[environment])
            _config_file = open(full_path)
            config = yaml.load(_config_file)
        except IOError as e:
            print("Expected to find a file at {0}, proceeding without.".format(full_path))
        except KeyError:
            print("No default config file path set for the {0} environment, proceeding without".format(environment))

    for key, value in config.items():
        app.config[key] = value

    for envvar in _ENVVAR:
        key, t = envvar
        val = os.environ.get(key, app.config[key])
        val = t(val)
        app.config[key] = val

    for envvar in _PREFIXED_ENVVAR:
        key, t = envvar
        if key.startswith(prefix):
            key = key[len(prefix) + 1:]
            val = os.environ.get(key, app.config[key])
            val = t(val)
            app.config[key] = val
