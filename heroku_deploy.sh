#!/bin/sh

# Deploys to heroku, assuming a heroku remote exists and the deploy branch does
# not.
# TODO: Don't assume these things.
DEPLOY_BRANCH=heroku_deploy
FRONTEND_DIR=frontend
DIST_PATH=$FRONTEND_DIR/dist
COMMIT_MSG="Heroku deploy: `date -u +"%T %y/%m/%d"`."

CUR_BRANCH=`git branch | grep "^\* .*$" | cut --delimiter=' ' --fields=2`

git stash && git checkout master -b $DEPLOY_BRANCH &&
    grunt && git add --force $DIST_PATH && git commit -m "$COMMIT_MSG" && \
    git push --force heroku $DEPLOY_BRANCH:master && \
    echo "--- Deployment success ---"
    git checkout $CUR_BRANCH && git branch -D $DEPLOY_BRANCH && git stash pop
