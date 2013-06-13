#!/bin/sh

. ./venv/bin/activate

rtn=0

echo "Running tests..."
grunt_out=`grunt test 2>&1`
if [ $? != 0 ]; then
    echo "$grunt_out"
    rtn=1
fi

py_out=`python run_tests.py 2>&1`
if [ $? != 0 ]; then
    echo "$py_out"
    rtn=1
fi

pep_out=`pep8 mongows tests run*.py 2>&1`
if [ $? != 0 ]; then
    echo "$pep_out"
    rtn=1
fi

exit $rtn
