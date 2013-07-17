#!/bin/bash

. ./venv/bin/activate

echo 'Checking for licenses'
missing=`./license.sh --check`
if [[ -n $missing ]]; then
    echo The following files are missing licenses:
    echo "$missing"
    exit 1
fi

echo "Running tests..."
git stash -u --keep-index > /dev/null
grunt_out=`grunt test 2>&1`
exit_code=$?
git stash pop > /dev/null
if [ $exit_code != 0 ]; then
    echo "$grunt_out"
    exit 1
fi
