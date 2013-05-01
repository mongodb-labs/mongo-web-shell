from mongows import create_app

if __name__ == '__main__':
    app = create_app()
    host, port = app.config['HOST'], app.config['PORT']
    app.run(host=host, port=port)
