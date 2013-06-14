from mongows import create_app
from mongows.mws.db import get_db


def ensureIndices(app):
    with app.app_context():
        db = get_db()
        db.ratelimit.ensure_index([('session_id', 1), ('timestamp', 1)])
        db.ratelimit.ensure_index('timestamp',
                                  background=True,
                                  expireAfterSeconds=60)


if __name__ == '__main__':
    app = create_app()
    host, port = app.config['HOST'], app.config['PORT']
    ensureIndices(app)
    app.run(host=host, port=port)
