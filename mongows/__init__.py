from flask import Flask
app = Flask(__name__, instance_relative_config=True)
app.config.from_object('mongows.default_config.settings')
app.config.from_pyfile('settings.cfg', silent=True)

from mongows.default_config import config_from_envvar
import mongows.views

config_from_envvar(app)
