from importlib import import_module
from flask import Blueprint, request

initializers = Blueprint('initializers', __name__, url_prefix='/init')


@initializers.route('/<script_name>', methods=['POST'])
def run_initializer(script_name):
    res_id = request.json['res_id']
    try:
        module = import_module('mongows.initializers.scripts.%s' % script_name)
    except ImportError:
        return 'Unknown initialization script %s' % script_name, 404
    if len(request.json) > 1:
        module.run(res_id, request.json)
    else:
        module.run(res_id)
    return 'ok', 200
