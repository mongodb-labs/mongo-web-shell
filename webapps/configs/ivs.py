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

# flask.config settings.
DEBUG = True
SECRET_KEY = 'A0gjhsd3678HK'

# Misc settings.
HOST = '0.0.0.0'
LOGGING_CONF = 'webapps/configs/logging.yaml'
PORT = 8081

# DB Settings
DB_HOST = 'localhost'
DB_PORT = 27017
DB_NAME = 'mongows'

# edX integration
EDX_SHARED_KEY = 'wanderlust'
GRADING_SERVER_URL = 'http://localhost'
