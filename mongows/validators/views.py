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

validators = Blueprint('validators', __name__, url_prefix='/validate')


@validators.route('/<script_name>', methods=['POST'])
def run_validator(script_name):
    res_id = request.form['res_id']
    try:
        module = import_module('mongows.validators.scripts.%s' % script_name)
    except ImportError:
        return 'Unknown validation script %s' % script_name, 404
    return module.ValidationTestCase(res_id).run()
