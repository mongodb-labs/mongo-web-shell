from flask import Flask
app = Flask(__name__, instance_relative_config=True)
app.config.from_object('mongows.config.default_settings')
app.config.from_pyfile('settings.cfg', silent=True)

from mongows.config import config_from_envvar, init_logging
import mongows.views

config_from_envvar(app)
init_logging()
