from importlib import import_module
from flask import Blueprint, request

validators = Blueprint('validators', __name__, url_prefix='/validate')


@validators.route('/<script_name>', methods=['POST'])
def run_validator(script_name):
    res_id = request.form['res_id']
    try:
        module = import_module('mongows.validators.scripts.%s' % script_name)
    except ImportError:
        return 'Unknown validation script %s' % script_name, 404
    return module.ValidationTestCase(res_id).run()
