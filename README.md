mongo-web-shell
===============
A recreation of the interactive mongoDB shell for the browser.

The shell input is initially evaluated in the browser with all appropriate
database queries being forwarded to (and returned from) a running mongod
instance on the back-end server.

Installation
------------
__Requirements__:

* [mongoDB][mongoDB install]
* [node.js][]
* [Python 2.7]
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

Then run the server from within your virtual environment:

    python run.py

To enable Flask debug mode, which restarts the server whenever any source files
change, set the `DEBUG` environment variable to any value.

    DEBUG=1 python run.py

By default, you can connect to the running sample at
<http://localhost:5000/sample/>.

### Foreman
The recommended method of running is to use [foreman][] as it performs both the
"Building" and "Running" steps above (except for starting a `mongod` instance).

    foreman start -f Procfile.dev

You can create a `.env` file to specify debug mode and set other environment
variables (see the [wiki][wiki-config] for more). See `.env.sample` for an
example.

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
