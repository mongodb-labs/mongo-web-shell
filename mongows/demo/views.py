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

from flask import Blueprint, render_template

demo = Blueprint(
    'demo', __name__, url_prefix='', template_folder='templates',
    static_url_path='', static_folder='../../frontend')


@demo.route('/')
def render():
    return render_template('default.html')

@demo.route('/try')
def render_try_page():
    return render_template('try.html')

@demo.route('/events_demo')
def render_events_demo():
    return render_template('events_demo.html')
