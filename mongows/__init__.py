import os

from flask import Flask
app = Flask(__name__)
app.config.from_object('mongows.default_settings')

_SETTINGS_ENVVAR = 'MONGOWS_SETTINGS'
if os.getenv(_SETTINGS_ENVVAR):
    app.config.from_envvar(_SETTINGS_ENVVAR)

import mongows.views
