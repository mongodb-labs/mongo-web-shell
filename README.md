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


### Environment variables

`CONFIG_FILENAME` - the configuration file that Flask will use to start the server, see `sample.yml` for an example.
Also see `webapps/lib/conf.py` for different default configuration paths depending on environment. This path is resolved
relative to the root directory of the git repo, and can either be a relative or absolute filepath.

`MWS_FLASK_STATIC` - if set, this will have Flask serve static the static files, note that this should only be used
for development, and production webservers such as apache (see below) or nginx should be used for production.


### The Tutorial

For production, consider using apache with a configuration similar to this:

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

For development, set the `MWS_FLASK_STATIC` environment variable to enable Flask to serve static files automatically.

Note that only one of these options, and not both should be used.

### The Server Webapp

The server webapp can be run with:

    python -m webapps.server.app

To set any environment variables for the script, use the `env` command. For example to run the server using the sample
configuration file and to use Flask to serve static files, use the following command from the root of the git repo:

    env CONFIG_FILENAME=sample.yml MWS_FLASK_STATIC='' python -m webapps.server.app

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

In a development environment, you can specify configuration in a number of ways.

You can choose to specify configurations by

 1. Specify a yaml file containing configuration.  For example, on my system
I specify this:
        export CONFIG_FILENAME=/home/ian/development/mongo-web-shell/sample.yml

In staging and production, because apache doesn't play well with environment
variables, we default to /opt/10gen/trymongo-<env>/shared/config.yml

 2. Any of the variables that appear in `webapps/lib/conf.py` can be
 overridden with environment variables - they will override anything in the
 configuration file.

More info
---------
See the project [wiki][].

[wiki-config]: https://github.com/10gen-labs/mongo-web-shell/wiki/Configuration
[Grunt]: http://gruntjs.com/
[jshint]: http://jshint.org/
[mongoDB install]: http://docs.mongodb.org/manual/installation/
[node.js]: http://nodejs.org/
[pep8]: https://github.com/jcrocholl/pep8
[virtualenv]: http://www.virtualenv.org/en/latest/
[wiki]: https://github.com/10gen-labs/mongo-web-shell/wiki
