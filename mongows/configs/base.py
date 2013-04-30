"""
This module defines constants that are intended to be imported into the Flask
app configuration by default.

"""
# flask.config settings.
DEBUG = False

# Misc settings.
HOST = '0.0.0.0'
PORT = 5000

MONGO_URL = 'http://localhost:27017/db'

LOGGING_CONF = 'mongows/configs/logging.yaml'
