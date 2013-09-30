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
# The environment variable name and the key in app.config[key].
_ENVVAR = [
    ('DEBUG', bool),
    ('LOGGING_CONF', str),
]
_PREFIXED_ENVVAR = [
    # Web Shell server
    ('CORS_ORIGIN', str),
    ('SERVER_HOST', str),
    ('SERVER_PORT', int),
    # Try.mongodb.org frontend
    ('TRY_HOST', str),
    ('TRY_PORT', int),
    ('TRY_MWS_HOST', str),
    # Init Verification service
    ('IVS_HOST', str),
    ('IVS_PORT', int),
]


def update_config(app, prefix):
    """Overrides the flask app's configuration with envvar where applicable."""
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
