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

from importlib import import_module
from flask import Blueprint, request

initializers = Blueprint('initializers', __name__, url_prefix='/init')


@initializers.route('/<script_name>', methods=['POST'])
def run_initializer(script_name):
    res_id = request.json['res_id']
    try:
        module = import_module('mongows.initializers.scripts.%s' % script_name)
    except ImportError:
        return 'Unknown initialization script %s' % script_name, 404
    if len(request.json) > 1:
        module.run(res_id, request.json)
    else:
        module.run(res_id)
    return 'ok', 200
