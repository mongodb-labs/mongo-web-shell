"""
This module defines constants that are intended to be imported into the Flask
app configuration by default.

"""
import os

DEBUG = True
HOST = '0.0.0.0'
PORT = int(os.environ.get('PORT', 5000))
