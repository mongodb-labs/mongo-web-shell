"""
This module defines constants that are intended to be imported into the Flask
app configuration by default.

"""
import os

# flask.config settings.
DEBUG = True

# Misc settings.
HOST = '0.0.0.0'
PORT = int(os.environ.get('PORT', 5000))

MONGO_URL = os.environ.get('MONGOHQ_URL', 'http://localhost:27017/db')
