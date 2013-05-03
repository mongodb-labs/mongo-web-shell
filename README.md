mongo-web-shell
===============
BU Student project

Brown CS Department Specific Notes
----------------------------------
* When running `python`, you should use `python2.7` instead.
* When running `virtualenv`, you should use `virtualenv2.7` instead.
* When running `mongod`, you should specify a new database path with the
  `--dbpath` flag as the default path is not writable (ex: `mongod --dbpath
  <path>`).

Installation
------------
__Requirements__:
* Python 2.7
* [virtualenv](https://pypi.python.org/packages/source/v/virtualenv/)

After the above requirements are installed:

1. Clone the repository: `git clone git@github.com:10gen/mongo-web-shell.git`
   Note that if you are planning on contributing, you may wish to fork the repo
   into your own github repository space and clone that instead.
2. Change to the cloned directory: `cd mongo-web-shell.git`
3. Create a virtual environment: `virtualenv venv` A virtual environment allows
   you to sandbox and maintain project dependencies in the specified directory
   ("venv" in this case).
4. Enter the virtual environment: `source venv/bin/activate` This updates the
   path on your shell to point to the dependencies in your virtual environment.
5. Download the project dependencies: `pip install -r requirements.txt`
   "pip" is a Python package manager and "requirements.txt" is a text file
   containing a list of the dependencies needed.
6. Check out git submodules: run `git submodule init && git submodule update`

Running
-------
After following the installation directions above:

1. Launch a mongod instance: `mongod`

Run the following from a shell that has been activated with your virtual
environment (see Installation #4):

1. Run the server: `python run.py` (or `DEBUG=1 python run.py` for debug mode).

By default, you can connect to the sample at <http://localhost:5000/sample/>.

Testing
-------
Run the following from a shell that has been activated with your virtual
environment (see Installation #4):

1. Run the tests: `python run_tests.py`

TODO
----
* The "Brown CS Department" section should be removed before this is released.
* The above text explains more than it probably should in a prod environment.
  Considering removing some of it for brevity's sake.
