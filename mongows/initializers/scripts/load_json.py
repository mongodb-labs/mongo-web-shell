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

from mongows.mws.db import get_db
from mongows.mws.util import UseResId


def run(res_id, data):
    with UseResId(res_id):
        db = get_db()
        collections = data['collections']
        for collection, documents in collections.iteritems():
            db[collection].insert(documents)
