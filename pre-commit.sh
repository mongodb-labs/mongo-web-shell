#!/bin/sh

git status | egrep '# (Untracked files|Changes not staged for commit):'
if [[ $? -eq 0 ]]; then
    echo 'Please stage your changes or stash them before you commit.'
    exit 1
fi

. ./venv/bin/activate

echo "Running tests..."
grunt_out=`grunt test 2>&1`
exit_code=$?
if [ $exit_code != 0 ]; then
    echo "$grunt_out"
    exit 1
fi
