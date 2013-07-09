import logging
import logging.config
import os
import sys

from flask import Flask
import yaml

from .mws import mws
from .demo import demo
from .initializers import initializers
from .validators import validators

# The environment variable name and the key in app.config[key].
_ENVVAR = [
    'DEBUG',
    'HOST',
    'LOGGING_CONF',
    'MONGOHQ_URL',
    'NO_FRONTEND',
    'NO_VALIDATION',
    'PORT'
]


def create_app():
    app = Flask(__name__)
    app.config.from_object('mongows.configs.base')
    override_config_from_envvar(app)
    configure_logging(app)
    register_blueprints(app)
    return app


def override_config_from_envvar(app):
    """Overrides the flask app's configuration with envvar where applicable."""
    for envvar in _ENVVAR:
        app.config[envvar] = os.environ.get(envvar, app.config[envvar])

    # Correct data types.
    app.config['DEBUG'] = bool(app.config['DEBUG'])
    app.config['NO_FRONTEND'] = bool(app.config['NO_FRONTEND'])
    app.config['NO_VALIDATION'] = bool(app.config['NO_VALIDATION'])
    app.config['PORT'] = int(app.config['PORT'])


def configure_logging(app):
    """Configures the logging module for the app.

    If there is an error in reading the configuration file, logging for the app
    is disabled and execution continues.

    """
    try:
        with open(app.config['LOGGING_CONF']) as f:
            config_dict = yaml.load(f)
    except IOError as e:
        sys.stderr.write('WARNING::Unable to open logging configuration file: '
                         '%s' % str(e))
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
            logging.getLogger(__name__).info('Logging initialized.')
            return

    sys.stderr.write('\nWARNING::mongows logging disabled.\n')
    logging.getLogger('mongows').addHandler(logging.NullHandler())


def register_blueprints(app):
    app.register_blueprint(mws)
    if not app.config['NO_FRONTEND']:
        app.register_blueprint(demo)
    if not app.config['NO_INIT']:
        app.register_blueprint(initializers)
    if not app.config['NO_VALIDATION']:
        app.register_blueprint(validators)
