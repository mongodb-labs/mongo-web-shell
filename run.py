import os

# TODO: Importing main is a hack to get _init_logging to run. Remove for #6.
from mongows import app, main

# TODO: These constants should probably move to a config file. See #5.
HOST= '0.0.0.0'
PORT = int(os.environ.get('PORT', 5000))
DEBUG = True

if __name__ == '__main__':
    app.run(host=HOST, port=PORT, debug=DEBUG)
