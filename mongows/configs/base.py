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
NO_SAMPLE = False
PORT = 5000
