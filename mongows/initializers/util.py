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

from io import SEEK_SET
import os
from subprocess import Popen
from bson.json_util import loads
from werkzeug.exceptions import NotFound, InternalServerError
from mongows.mws.db import get_db
from mongows.mws.util import UseResId


def load_data_from_mongoexport(res_id, export_location, collection_name,
                               remove_id=False):
    """
    This file should come from mongoexport, with or without the --jsonArray
    flag. That is to say, it should either be a series of documents, each on
    its own line, or a single array of documents. All documents will be
    inserted into the given collection.
    """
    with open(export_location) as export:
        first_char = export.read(1)
        export.seek(0, SEEK_SET)
        if first_char == '[':
            # Data is already in an array
            documents = loads(export.read())
        else:
            # Each line of data is an object
            documents = []
            for line in export:
                documents.append(loads(line))
        if remove_id:
            _remove_id(documents)

        with UseResId(res_id):
            get_db()[collection_name].insert(documents)


def load_data_from_json(res_id, file_name, remove_id=False):
    """
    The top level of this file should be an object who's keys are collection
    names which map to an array of documents to be inserted into the collection
    """
    with open(file_name) as json_file:
        collections = loads(json_file.read())
        db = get_db()
        with UseResId(res_id):
            for collection, documents in collections.iteritems():
                if remove_id:
                    _remove_id(documents)
                db[collection].insert(documents)


def load_data_from_mongodump(res_id, dump_location, collection_name):
    """
    The dump location should point to a .bson file, not a directory structure
    as created by mongodump. Instead, use the .bson files inside this
    directory structure.
    """
    if not os.path.exists(dump_location):
        raise NotFound('Unable to find dump file')
    p = Popen((
        'mongorestore',
        '-d', 'mws',
        '-c', '%s%s' % (res_id, collection_name),
        dump_location
    ))
    p.communicate()  # Wait for process to finish
    if p.poll() != 0:
        raise InternalServerError('Loading dumped data failed')
    UseResId(res_id).insert_client_collection(collection_name)


def _remove_id(documents):
    """ Removes the _id field from each document in the array """
    for document in documents:
        if '_id' in document:
            del document['_id']
