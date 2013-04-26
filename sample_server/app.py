from flask import Flask, render_template
app = Flask(__name__, static_url_path='/static', static_folder='../frontend')

HOST = '0.0.0.0'
PORT = 8080
DEBUG = True

@app.route('/')
def render_tutorial():
    return render_template('tutorial.html')

if __name__ == '__main__':
    app.run(host=HOST, port=PORT, debug=DEBUG)
