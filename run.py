# TODO: Importing main is a hack to get _init_logging to run. Remove for #6.
from mongows import app, main

if __name__ == '__main__':
    host, port = app.config['HOST'], app.config['PORT']
    app.run(host=host, port=port)
