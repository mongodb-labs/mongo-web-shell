from flask import Flask
app = Flask(__name__)
app.config.from_object('mongows.default_config.settings')

from mongows.default_config import config_from_envvar
import mongows.views

config_from_envvar(app)
