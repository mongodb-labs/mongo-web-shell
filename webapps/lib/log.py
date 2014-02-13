import sys
import socket
import logging
import logging.handlers
import yaml

import logging
from logging.handlers import SMTPHandler


_logger = logging.getLogger(__name__)

class ResponseContextFilter(logging.Filter):
    """
    This is a filter which injects the web.py context into the log.
    """
    def filter(self, record):
        hostname = socket.gethostname()
        record.host = hostname
        from flask import request
        if request:
            record.method = request.method
            record.headers = request.headers
            record.environ = request.environ
            record.data = request.data
            record.path = request.path
        else:
            record.method = ""
            record.headers = ""
            record.environ = ""
            record.data = ""
            record.path = ""
        return True

def configure_logging(app, environment):
    """Configures the logging module for the app.
    """
    simple = logging.Formatter(
        fmt=(
            "%(levelname)s %(asctime)s(%(name)s#%(lineno)d)"
            "[%(method)s %(host)s%(path)s]"
            "%(data)s - %(message)s"
        )
    )

    email = logging.Formatter(
        fmt=(
            "%(asctime)s - %(levelname)s %(name)s\n"
            "%(pathname)s@%(funcName)s#%(lineno)d\n"
            "%(method)s @%(host)s%(path)s\n\n"
            "HEADERS: %(headers)s\n\n"
            "INPUT: %(data)s\n\n"
            "%(message)s"

        )
    )
    fmt = '[%(asctime)s] %(name)s::%(levelname)s::%(funcName)s(): %(message)s'
    if environment == "devel":
        ch = logging.StreamHandler()
        ch.addFilter(ResponseContextFilter())
        ch.setFormatter(simple)
        rl = logging.getLogger()
        rl.setLevel(logging.DEBUG)
        rl.addHandler(ch)
    elif environment == "staging":
        ch = logging.StreamHandler()
        ch.addFilter(ResponseContextFilter())
        ch.setLevel(logging.DEBUG)
        ch.setFormatter(simple)
        fh = logging.handlers.TimedRotatingFileHandler(
            '/var/log/trymongo-staging/trymongo.log',
            when='midnight',
            backupCount=30)
        fh.addFilter(ResponseContextFilter())
        fh.setFormatter(simple)
        fh.setLevel(logging.INFO)
        rl = logging.getLogger()
        rl.setLevel(logging.DEBUG)
        rl.addHandler(ch)
        rl.addHandler(fh)
    elif environment == "prod":
        eh = SMTPHandler('127.0.0.1',
            'noc+mws@10gen.com',
            app.config.get('ADMIN_EMAILS'), 'MWS Failure')
        eh.setLevel(logging.ERROR)
        eh.setFormatter(email)
        ch = logging.StreamHandler()
        ch.setLevel(logging.DEBUG)
        ch.setFormatter(simple)
        ch.addFilter(ResponseContextFilter())
        fh = logging.handlers.TimedRotatingFileHandler(
            '/var/log/trymongo-prod/trymongo.log',
            when='midnight',
            backupCount=30)
        fh.setFormatter(simple)
        fh.setLevel(logging.INFO)
        fh.addFilter(ResponseContextFilter())
        rl = logging.getLogger()
        rl.setLevel(logging.DEBUG)
        rl.addHandler(ch)
        rl.addHandler(fh)
        rl.addHandler(eh)
