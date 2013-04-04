from flask import Flask
app = Flask(__name__)
app.config.from_object('mongows.config.default_settings')

from mongows.config import config_from_envvar
import mongows.views

config_from_envvar(app)
