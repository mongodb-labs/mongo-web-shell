from mongows import app
from mongows.main import get_connection

@app.route('/')
def hello():
    db = get_connection()
    emptyset = db.some_collection.find()
    return 'Hello World! {0}'.format(emptyset.count())
