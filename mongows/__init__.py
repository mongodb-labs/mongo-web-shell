from flask import Flask
app = Flask(__name__)
app.config.from_object('mongows.default_config.settings')

import mongows.views
