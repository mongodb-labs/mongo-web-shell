import logging
import logging.config
import os
import sys

from flask import Flask
import yaml

from .mws import mws

# Array of (key in app.config[key], envvar).
_ENVVAR = [
    ('DEBUG',) * 2,
    ('MONGO_URL', 'MONGOHQ_URL'),
    ('PORT',) * 2
]

_DEFAULT_LOGGING_CONF = 'mongows/config/default_logging.yaml'
_INSTANCE_LOGGING_CONF = 'instance/logging.yaml'


def create_app():
    app = Flask(__name__, instance_relative_config=True)

    app.config.from_object('mongows.config.default_settings')
    # TODO: Is this used? In instance/ perhaps?
    app.config.from_pyfile('settings.cfg', silent=True)
    configure_from_envvar(app)
    configure_logging()
    register_blueprints(app)
    return app


def configure_from_envvar(app):
    """Overrides the flask app's configuration with envvar where applicable."""
    for key, envvar in _ENVVAR:
        app.config[key] = os.environ.get(envvar, app.config[key])

    # Correct data types.
    app.config['DEBUG'] = True if app.config['DEBUG'] else False
    app.config['PORT'] = int(app.config['PORT'])


def configure_logging():
    """Configures the logging module for the app.

    The function attempts to read an instance/ configuration file (if it
    exists) and creates the logging module's configuration based on this file.
    If it does not exist, the default configuration is used instead. If there
    is an error in reading any file, logging for the app is disabled and
    execution continues.

    """
    logging_conf = _DEFAULT_LOGGING_CONF
    if os.path.isfile(_INSTANCE_LOGGING_CONF):
        logging_conf = _INSTANCE_LOGGING_CONF

    try:
        with open(logging_conf) as f:
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
