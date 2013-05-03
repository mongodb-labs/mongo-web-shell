from flask import Blueprint, render_template

sample = Blueprint(
    'sample', __name__, url_prefix='/sample', template_folder='templates',
    static_url_path='/static', static_folder='../../frontend')


@sample.route('/')
def render_tutorial():
    return render_template('tutorial.html')
