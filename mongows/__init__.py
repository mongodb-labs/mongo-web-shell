from flask import Flask
app = Flask(__name__)
app.config.from_object('mongows.default_settings')

import mongows.views
