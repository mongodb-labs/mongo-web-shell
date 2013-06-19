#!/bin/sh

. ./venv/bin/activate

echo "Running tests..."
grunt_out=`grunt test 2>&1`
if [ $? != 0 ]; then
    echo "$grunt_out"
    exit 1
fi