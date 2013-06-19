from mongows import create_app
from mongows.crontab import run_scheduler
from mongows.mws.db import get_db


def ensure_indices(app):
    with app.app_context():
        db = get_db()
        db.ratelimit.ensure_index([('session_id', 1), ('timestamp', 1)])
        db.ratelimit.ensure_index('timestamp',
                                  background=True,
                                  expireAfterSeconds=60)


def main():
    global app, host, port
    app = create_app()
    host, port = app.config['HOST'], app.config['PORT']
    run_scheduler(app)
    ensure_indices(app)
    app.run(host=host, port=port)


if __name__ == '__main__':
    main()
