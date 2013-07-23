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
MONGOHQ_URL = 'http://localhost:27017/mws'
NO_FRONTEND = False
NO_VALIDATION = False
NO_INIT = False
PORT = 5000

RATELIMIT_COLLECTION = 'ratelimit'
RATELIMIT_QUOTA = 500  # requests per expiry
RATELIMIT_EXPIRY = 60  # expiry in seconds

QUOTA_COLLECTION_SIZE = 5 * 1024 * 1024  # size quota in bytes

# QUOTA_NUM_COLLECTIONS: number of collections per res_id
# False: unlimited number of collections, no quota
# 0: user is unable to create additional collections
# 1+: user may have up to # collections per res_id
QUOTA_NUM_COLLECTIONS = 8
