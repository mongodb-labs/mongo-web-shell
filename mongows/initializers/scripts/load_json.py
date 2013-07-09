from mongows.mws.db import get_db
from mongows.mws.util import UseResId


def run(res_id, data):
    with UseResId(res_id):
        db = get_db()
        collections = data['collections']
        for collection, documents in collections.iteritems():
            db[collection].insert(documents)
