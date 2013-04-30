"""
This module defines constants that are intended to be imported into the Flask
app configuration by default.

"""
# flask.config settings.
DEBUG = False

# Misc settings.
HOST = '0.0.0.0'
LOGGING_CONF = 'mongows/configs/logging.yaml'
MONGOHQ_URL = 'http://localhost:27017/db'
NO_SAMPLE = False
PORT = 5000
