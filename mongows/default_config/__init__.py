import os

# Array of (app.config[key], 'envvar').
_ENVVAR = [
        ('MONGO_URL', 'MONGOHQ_URL'),
        ('PORT',) * 2
]

def config_from_envvar(app):
    """Overrides the flask app's configuration with envvar where applicable."""
    for key, envvar in _ENVVAR:
        app.config[key] = os.environ.get(envvar, app.config[key])

    # Correct data types.
    app.config['PORT'] = int(app.config['PORT'])
