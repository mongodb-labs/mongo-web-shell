from urlparse import urlparse
import logging
import logging.config
import os
import sys

from flask import Flask
import pymongo
import yaml

from mongows import app

HOST= '0.0.0.0'
PORT = int(os.environ.get('PORT', 5000))
MONGO_URL = os.environ.get('MONGOHQ_URL', 'http://localhost:27017/db')
DEBUG = True

CONF_DIR = 'conf/'
LOGGING_DIR = CONF_DIR + 'logging/'
DEFAULT_LOGGING_CONF_FILE = LOGGING_DIR + 'default.yaml'

_logger = None
db = None

def main():
    app.run(host=HOST, port=PORT, debug=DEBUG)

def get_connection():
    global db
    if db:
        return db
    config = urlparse(MONGO_URL)
    db_name = config.path.rpartition('/')[2]
    connection = pymongo.MongoClient(config.hostname, config.port)
    db = connection[db_name]
    if config.username:
        db.authenticate(config.username, config.password)
    return db

@app.route('/')
def hello():
    db = get_connection()
    emptyset = db.some_collection.find()
    return 'Hello World! {0}'.format(emptyset.count())

def _init_logging():
    """Returns a configured Logger object.

    The function attempts to read from the default logging configuration file.
    If successful, the returned Logger is configured as stated in the file. If
    an error occurs, a Logger configured to print nothing is returned.

    """
    try:
        with open(DEFAULT_LOGGING_CONF_FILE) as f:
            config_dict = yaml.load(f)
    except IOError as e:
        sys.stderr.write('WARNING::Unable to open logging configuration '
                'file: %s' % str(e))
    except yaml.YAMLError as e:
        sys.stderr.write('WARNING::Unable to parse yaml configuration file: '
                '%s' % str(e))
    else:
        try:
            logging.config.dictConfig(config_dict)
        except (ValueError, TypeError, AttributeError, ImportError) as e:
            sys.stderr.write('WARNING::dictConfig() failed to create '
                    'configuration from file: %s' % str(e))
        else:
            logger = logging.getLogger(__name__)
            logger.info('Logging initialized.')
            return logger

    sys.stderr.write('\nWARNING::Logging disabled.\n')
    logger = logging.getLogger(__name__)
    logger.addHandler(logging.NullHandler())
    return logger

_logger = _init_logging()

if __name__ == '__main__':
    main()
