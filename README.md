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
* Python 2.7
* [virtualenv][]

After the above requirements are installed, clone the repo:

    git clone git@github.com:10gen-labs/mongo-web-shell.git && \
        cd mongo-web-shell

Create and activate a virtualenv:

    virtualenv venv && \
        source venv/bin/activate

Retrieve the dependencies:

    git submodule init && git submodule update
    pip install -r requirements.txt

Running
-------
After the installation above, launch a mongod instance that will be accessed by
the back-end:

    mongod

Then run the server from within your virtual environment:

    python run.py

To enable Flask debug mode, set the `DEBUG` environment variable to any value.
Alternatively, run via [foreman][] and specify the environment variable in a
.env file.

By default, you can connect to the running sample at
<http://localhost:5000/sample/>.

Tests
-----
### Front-end
Open frontend/SpecRunner.html in a browser.

### Back-end
From within a virtual environment:

    python run_tests.py

More info
---------
See docs/.

[foreman]: http://ddollar.github.io/foreman/
[mongoDB install]: http://docs.mongodb.org/manual/installation/
[virtualenv]: http://www.virtualenv.org/en/latest/
