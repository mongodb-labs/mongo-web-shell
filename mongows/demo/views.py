from flask import Blueprint, render_template

demo = Blueprint(
    'demo', __name__, url_prefix='', template_folder='templates',
    static_url_path='', static_folder='../../frontend')


@demo.route('/')
def render():
    return render_template('default.html')


@demo.route('/events_demo')
def render_events_demo():
    return render_template('events_demo.html')
