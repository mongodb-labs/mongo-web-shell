#!/bin/bash

git status | egrep '# (Untracked files|Changes not staged for commit):'
if [[ $? -eq 0 ]]; then
    echo 'Please stage your changes or stash them before you commit.'
    exit 1
fi

. ./venv/bin/activate

echo 'Checking for licenses'
missing=`./license.sh --check`
if [[ -n $missing ]]; then
    echo The following files are missing licenses:
    echo "$missing"
    exit 1
fi

echo "Running tests..."
grunt_out=`grunt test 2>&1`
exit_code=$?
if [ $exit_code != 0 ]; then
    echo "$grunt_out"
    exit 1
fi
