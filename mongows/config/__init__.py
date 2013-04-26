import logging
import logging.config
import os
import sys

import yaml

# Array of (app.config[key], 'envvar').
_ENVVAR = [
        ('MONGO_URL', 'MONGOHQ_URL'),
        ('PORT',) * 2
]

_DEFAULT_LOGGING_CONF = 'mongows/config/default_logging.yaml'
_INSTANCE_LOGGING_CONF = 'instance/logging.yaml'

def config_from_envvar(app):
    """Overrides the flask app's configuration with envvar where applicable."""
    for key, envvar in _ENVVAR:
        app.config[key] = os.environ.get(envvar, app.config[key])

    # Correct data types.
    app.config['PORT'] = int(app.config['PORT'])

def init_logging():
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
