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

import json
import requests
import traceback

from flask import Blueprint, current_app, jsonify, request, session

from importlib import import_module
from itsdangerous import BadSignature, Signer

from webapps.decorators import ratelimit
from webapps.lib import CLIENTS_COLLECTION
from webapps.lib.db import get_db
from webapps.lib.decorators import ratelimit
from webapps.lib.MWSServerError import MWSServerError


ivs = Blueprint(
    'ivs', __name__, url_prefix='/ivs', template_folder='templates',
    static_url_path='', static_folder='../../frontend'
)

import logging
_logger = logging.getLogger(__name__)


@ivs.route('/init/<script_name>', methods=['POST'])
@ratelimit
def init(script_name):
    res_id = _get_res_id()
    try:
        module = 'webapps.ivs.initializers.scripts.{0}'.format(script_name)
        module = import_module(module)
    except ImportError as e:
        raise MWSServerError(404, str(e))
    try:
        module.run(res_id, request)
    except Exception as e:
        _logger.error('Init script {0} threw exception {1}'.format(
            script_name, str(e)))
        _logger.error('Traceback: {0}'.format(traceback.format_exc()))
        raise MWSServerError(500, type(e).__name__, str(e))
    return jsonify(
        success=True,
        msg='Collection initialized successfully')


@ivs.route('/verify/<script_name>', methods=['POST'])
@ratelimit
def verify(script_name):
    res_id = _get_res_id()
    user_id = _get_user_id()
    if 'course_id' not in request.values or 'problem_id' not in request.values:
        raise MWSServerError(400, "Course or Problem not specified.")
    else:
        course_id = request.values['course_id']
        problem_id = request.values['problem_id']
    try:
        module = 'webapps.ivs.verify.scripts.{0}'.format(script_name)
        module = import_module(module)
    except ImportError as e:
        raise MWSServerError(404, str(e))
    try:
        results = module.run(res_id, request)
    except Exception as e:
        _logger.error('Verification script {0} threw exception {1}'.format(
            script_name, str(e)))
        _logger.error('Traceback: {0}'.format(traceback.format_exc()))
        raise MWSServerError(500, type(e).__name__, str(e))
    server_url = current_app.config.get('GRADING_SERVER_URL')
    post_url = '{0}/api/v1/grade/{1}/{2}/{3}'.format(
        server_url,
        course_id,
        problem_id,
        user_id)
    response = requests.post(post_url, data=results)
    if response.status_code != 200:
        raise MWSServerError(response.status_code, response.text)
    return jsonify(**(json.loads(response.text)))


def _get_user_id():
    if current_app.config.get('DEBUG'):
        return request.values.get('user_id')

    if 'mws-track-id' not in request.cookies:
        raise MWSServerError(400, "Invalid request (missing cookie)")

    key = current_app.config.get('EDX_SHARED_KEY')
    s = Signer(key)
    try:
        user_id = s.unsign(request.cookies['mws-track-id'])
    except (BadSignature, TypeError) as e:
        _logger.exception(e)
        raise MWSServerError(403, "Invalid request (invalid cookie)")
    return user_id


def _get_res_id():
    if 'session_id' not in session:
        raise MWSServerError(400, "Invalid request (missing session)")
    session_id = session['session_id']
    clients = get_db()[CLIENTS_COLLECTION]
    doc = clients.find_one({'session_id': session_id}, {'res_id': 1, '_id': 0})
    if not doc:
        raise MWSServerError(500, "Resource id not associated with session")
    return doc['res_id']
