mongo-web-shell
===============
A recreation of the interactive mongoDB shell for the browser.

There are three components related to the shell captured in this repo:

1. The server webapp - A flask application that provides a RESTish API for \
    interacting with MongoDB.
2. The tutorial static html page - A static html file that initializes a \
    shell, and hosts a simple tutorial.
3. The init-verification webapp - An api for confirming the validitiy of the \
    contents of a users' databases.


Installation
------------
__Requirements__:

* [mongoDB][mongoDB install]
* [node.js][]
* [Python 2.6+]
* [virtualenv][]

After the above requirements are installed, clone the repo:

    git clone git@github.com:10gen-labs/mongo-web-shell.git && \
        cd mongo-web-shell

Create and activate a virtualenv:

    virtualenv venv && \
        source venv/bin/activate

In addition to some git submodules, the back-end dependencies are managed by
pip, while the front-end dependencies are managed via npm.

    git submodule init && git submodule update
    pip install -r requirements.txt
    npm install

[Grunt][] is used to build the front-end code.

    npm install -g grunt-cli

### Linters
All committed code should be linted.

Front-end: [jshint][]. Installation will occur in the `package.json`
dependencies.

Back-end: [pep8][]. Installation via pip within the virtual environment is
recommended:

    pip install pep8

Building
--------
The default Grunt task will build the front-end code.

    grunt

To perform this build whenever any source files change, use the `watch` target.

    grunt watch

Running
-------
After the installation and build above, launch a mongod instance that will be
accessed by the back-end server:

    mongod

Make sure that you have activated your virtualenv

### The Server Webapp

The server webapp can be run with:

    python -m webapps.server.app

To enable Flask debug mode, which restarts the server whenever any source files
change, set the `DEBUG` environment variable to any value.

    DEBUG=1 python -m webapp.server.app

### The Tutorial

Consider using apache with a configuration similar to this:

    <VirtualHost *:80>
        DocumentRoot [path to mongo-web-shell]/frontend

        DirectoryIndex index.html
        <Directory "[path to mongo-web-shell]">
            Order deny,allow
            Allow from all
            Require all granted
        </Directory>

        ProxyPass /server http://127.0.0.1:5000
        ProxyPassReverse /server http://127.0.0.1:5000

    </VirtualHost>

Make sure that you've run `grunt` to build the assets first.

Tests
-----
### Front-end
Lint the code and run the test suite via the `test` target.

    grunt test

To lint by hand, use the `jshint` target.

    grunt jshint

To test in a browser environment, open `frontend/SpecRunner.html`.

### Back-end
From within a virtual environment:

    python run_tests.py

Lint via pep8.

    pep8 mongows tests run*.py

Configuration
-------------

In a development environment, you can specify configration in a number of ways.

You can choose to specify configurations by

 1. Specify a yaml file containing configuration.  For example, on my system
I specify this:
    export CONFIG_FILENAME=/home/ian/development/mongo-web-shell/sample.yml

In staging and production, because apache doesn't play well with environment
varaibles, we default to /opt/10gen/trymongo-<env>/shared/config.yml

 2. Any of the variables that appear in `webapps/lib/conf.py` can be
 overridden with environment variables - they will override anything in the
 configuration file.

More info
---------
See the project [wiki][].

[wiki-config]: https://github.com/10gen-labs/mongo-web-shell/wiki/Configuration
[foreman]: http://ddollar.github.io/foreman/
[Grunt]: http://gruntjs.com/
[jshint]: http://jshint.org/
[mongoDB install]: http://docs.mongodb.org/manual/installation/
[node.js]: http://nodejs.org/
[pep8]: https://github.com/jcrocholl/pep8
[virtualenv]: http://www.virtualenv.org/en/latest/
[wiki]: https://github.com/10gen-labs/mongo-web-shell/wiki
[Python 2.7]: http://www.python.org/download/releases/2.7.5
