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

"""
This module defines constants that are intended to be imported into the Flask
app configuration by default.

"""
# flask.config settings.
DEBUG = False
SECRET_KEY = 'foo'


#DB Settings
DB_HOSTS = ["localhost"]
DB_PORT = 27017
DB_NAME = 'mongows'


HOST = "0.0.0.0"
PORT = 5000

RATELIMIT_COLLECTION = 'server_ratelimit'
RATELIMIT_QUOTA = 500  # requests per expiry
RATELIMIT_EXPIRY = 60  # expiry in seconds

QUOTA_COLLECTION_SIZE = 5 * 1024 * 1024  # size quota in bytes

# QUOTA_NUM_COLLECTIONS: number of collections per res_id
# False: unlimited number of collections, no quota
# 0: user is unable to create additional collections
# 1+: user may have up to # collections per res_id
QUOTA_NUM_COLLECTIONS = 8

# Cursors config
CURSOR_BATCH_SIZE = 20  # default max docs to return for a query

# Logging config
ADMIN_EMAILS = ''
LOG_FILE_PATH = ''
