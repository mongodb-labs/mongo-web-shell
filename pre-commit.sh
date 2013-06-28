#!/bin/sh

. ./venv/bin/activate

echo "Running tests..."
git stash -u --keep-index > /dev/null
grunt_out=`grunt test 2>&1`
exit_code=$?
git stash pop > /dev/null
if [ $exit_code != 0 ]; then
    echo "$grunt_out"
    exit 1
fi
