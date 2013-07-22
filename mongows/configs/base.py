"""
This module defines constants that are intended to be imported into the Flask
app configuration by default.

"""
# flask.config settings.
DEBUG = False
SECRET_KEY = 'A0gjhsd3678HK'

# Misc settings.
HOST = '0.0.0.0'
LOGGING_CONF = 'mongows/configs/logging.yaml'
DB_NAME = 'mws'
MONGOHQ_URL = 'http://localhost:27017/' + DB_NAME
NO_FRONTEND = False
NO_VALIDATION = False
NO_INIT = False
PORT = 5000

RATELIMIT_COLLECTION = 'ratelimit'
RATELIMIT_QUOTA = 500  # requests per expiry
RATELIMIT_EXPIRY = 60  # expiry in seconds

QUOTA_COLLECTION_SIZE = 5 * 1024 * 1024  # size quota in bytes
