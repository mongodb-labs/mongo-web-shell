from werkzeug.exceptions import HTTPException
from werkzeug.wrappers import BaseResponse

from bson.json_util import dumps


class MWSServerError(HTTPException):
    def __init__(self, error=500, message='', detail=''):
        self.error = error
        self.message = message
        self.detail = detail

    def get_body(self, environ):
        return dumps({
            'error': self.error,
            'reason': self.message,
            'detail': self.detail
        })

    def get_response(self, environ):
        headers = [('Content-Type', 'application/json')]
        return BaseResponse(self.get_body(environ), self.error, headers)
