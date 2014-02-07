import sys
import logging
import logging.config
import logging.handlers
import yaml

_logger = logging.getLogger(__name__)


def configure_logging(app):
    """Configures the logging module for the app.

    If there is an error in reading the configuration file, logging for the app
    is disabled and execution continues.

    """
    fmt = '[%(asctime)s] %(name)s::%(levelname)s::%(funcName)s(): %(message)s'
    simple_fmt = logging.Formatter(fmt=fmt)
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    ch.setFormatter(simple_fmt)
    rl = logging.getLogger()
    rl.setLevel(logging.DEBUG)
    rl.addHandler(ch)
    fh = logging.handlers.TimedRotatingFileHandler(
        '/var/log/trymongo-prod/trymongo.log',
        when='midnight',
        backupCount=30)
    fh.setFormatter(simple_fmt)
    fh.setLevel(logging.INFO)
