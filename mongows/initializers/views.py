from importlib import import_module
from flask import Blueprint, request
from mongows.mws.MWSServerError import MWSServerError

initializers = Blueprint('initializers', __name__, url_prefix='/init')


@initializers.route('/<script_name>', methods=['POST'])
def run_initializer(script_name):
    res_id = request.json['res_id']
    try:
        module = import_module('mongows.initializers.scripts.%s' % script_name)
    except ImportError:
        return 'Unknown initialization script %s' % script_name, 404
    try:
        if len(request.json) > 1:
            ret = module.run(res_id, request.json)
        else:
            ret = module.run(res_id)
        if ret:
            return ret
    except Exception as e:
        raise MWSServerError(500, type(e).__name__, str(e))
    else:
        return '', 204
