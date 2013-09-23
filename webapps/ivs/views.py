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

import traceback

from flask import Blueprint, current_app

from importlib import import_module
from flask import request
from webapps.lib.MWSServerError import MWSServerError
from webapps.ivs.lib.naivesign import decode_signed_value

ivs = Blueprint(
    'ivs', __name__, url_prefix='', template_folder='templates',
    static_url_path='', static_folder='../../frontend')

import sys
import logging
_logger = logging.getLogger(__name__)


@ivs.route('/init/<script_name>')
def init(script_name):
    if current_app.config.get('DEBUG'):
        user_id = request.values.get('user_id')
    elif 'mws-track-id' not in request.cookies:
        raise MWSServerError(400, "Invalid request (missing cookie)")
    else:
        key = current_app.config.get('EDX_SHARED_KEY')
        user_id = decode_signed_value(key, request.cookies['mws-track-id'])
    try:
        module = 'webapps.ivs.initializers.scripts.{0}'.format(script_name)
        module = import_module(module)
    except ImportError as e:
        raise MWSServerError(404, str(e))
    try:
        success = module.run(user_id, request)
    except Exception as e:
        _logger.error('Init script {0} threw exception {1}'.format(
            script_name, str(e)))
        _logger.error('Traceback: {0}'.format(traceback.format_exc()))
        raise MWSServerError(500, type(e).__name__, str(e))
    return 'Collection initilaized successfully', 200


@ivs.route('/verify/<script_name>')
def init(script_name):
    if current_app.config.get('DEBUG'):
        user_id = request.values.get('user_id')
    elif 'mws-track-id' not in request.cookies:
        raise MWSServerError(400, "Invalid request (missing cookie)")
    else:
        key = current_app.config.get('EDX_SHARED_KEY')
        user_id = decode_signed_value(key, request.cookies['mws-track-id'])
    if 'course_id' not in request.values or 'problem_id' not in request.values:
        raise MWSServerError(400, "Course of Problem not specified.")
    else:
        course_id = request.values['course_id']
        problem_id = request.values['problem_id']
    try:
        module = 'webapps.ivs.verify.scripts.{0}'.format(script_name)
        module = import_module(module)
    except ImportError as e:
        raise MWSServerError(404, str(e))
    try:
        grade = module.run(user_id, request)
    except Exception as e:
        _logger.error('Verification script {0} threw exception {1}'.format(
            script_name, str(e)))
        _logger.error('Traceback: {0}'.format(traceback.format_exc()))
        raise MWSServerError(500, type(e).__name__, str(e))
        server_url = current_app.config.get('GRADING_SERVER_URL')
        post_url = '{0}/api/v1.0/grade/{1}/{2}/{3}'.format(
            server_url,
            course_id,
            problem_id,
            user_id)
        r = requests.post(server_url, params=json.dumps(grade))
       # TODO: Post return value from script
    return json.dumps(grade), 200
