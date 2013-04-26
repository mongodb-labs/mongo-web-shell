from mongows import app

if __name__ == '__main__':
    host, port = app.config['HOST'], app.config['PORT']
    app.run(host=host, port=port)
