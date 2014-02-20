import socket
import logging
import logging.handlers
from logging.handlers import SMTPHandler


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

    if environment == "devel":
        ch = logging.StreamHandler()
        ch.addFilter(ResponseContextFilter())
        ch.setFormatter(simple)
        rl = logging.getLogger()
        rl.setLevel(logging.DEBUG)
        rl.addHandler(ch)
    elif environment == "staging":
        rl = logging.getLogger()
        rl.setLevel(logging.DEBUG)
        if app.config.get('LOG_FILE_PATH', None):
            fh = logging.handlers.TimedRotatingFileHandler(
                app.config.get('LOG_FILE_PATH'),
                when='midnight',
                backupCount=30)
            fh.addFilter(ResponseContextFilter())
            fh.setFormatter(simple)
            fh.setLevel(logging.INFO)
            rl.addHandler(fh)
    elif environment == "prod":
        rl = logging.getLogger()
        rl.setLevel(logging.DEBUG)
        if app.config.get('ADMIN_EMAILS', None):
            eh = SMTPHandler('127.0.0.1',
                'noc+mws@10gen.com',
                app.config.get('ADMIN_EMAILS'), 'MWS Failure')
            eh.setLevel(logging.ERROR)
            eh.setFormatter(email)
            rl.addHandler(eh)
        if app.config.get('LOG_FILE_PATH', None):
            fh = logging.handlers.TimedRotatingFileHandler(
                app.config.get('LOG_FILE_PATH'),
                when='midnight',
                backupCount=30)
            fh.addFilter(ResponseContextFilter())
            fh.setFormatter(simple)
            fh.setLevel(logging.INFO)
            rl.addHandler(fh)
