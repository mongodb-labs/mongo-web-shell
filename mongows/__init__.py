from flask import Flask
app = Flask(__name__)
app.config.from_object('mongows.config.default_settings')

import mongows.views
