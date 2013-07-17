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

from flask import Flask, render_template
app = Flask(__name__, static_url_path='/static', static_folder='../frontend')

HOST = '0.0.0.0'
PORT = 8080
DEBUG = True

app.config['MWS_HOST'] = os.environ.get('MWS_HOST', 'http://localhost:5000')


@app.route('/')
def render_tutorial():
    return render_template('tutorial.html')

if __name__ == '__main__':
    app.run(host=HOST, port=PORT, debug=DEBUG)
