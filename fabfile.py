from contextlib import nested
from datetime import datetime
import time

from fabric.api import run, env, task, execute, runs_once, parallel
from fabric.context_managers import cd, prefix
import requests

from webapps.lib.conf import get_deploy_config

c = get_deploy_config()

env.use_ssh_config = True


config = {
    'basedir': '/opt/10gen/',
    'project': 'trymongo',
    'origin': 'git@github.com:10gen-labs/mongo-web-shell.git',
    'credentials': '/opt/10gen/{0}-{1}/shared/config.yml'
}

env.roledefs = {
    'staging': ['trymongo-staging.10gen.cc'],
    'prod': ['trymongo-1.10gen.cc', 'trymongo-2.10gen.cc']
}

f_credentials = c.get('flowdock_credentials')
f_user = f_credentials.get('user')
f_pass = f_credentials.get('password')
flowdock_url = 'https://api.flowdock.com/flows/10gen/tools/messages'

datetime_format = '%Y%m%d%H%M%S'

def broadcast(msg):
    if f_user and f_pass:
        requests.post(flowdock_url, auth=(f_user, f_pass), data={
            'event': 'message',
            'content': msg
        })

## Wrap with runs_once to prevent this task from running multiple times per host
@runs_once
@task
def deploy(refspec):
    releasedir_map = execute(load_deploy, refspec)
    execute(swap_deploy, releasedir_map)

@task
def swap_deploy(releasedir_map):
    ## releasedir_map is a dict that maps host to releasedir
    releasedir = releasedir_map[env['host']]

    role = env.roles[0]
    project_user = config['project'] + '-' + role
    projectdir = project_user + '/'
    basedir = config['basedir'] + projectdir + 'releases/'

    try:
        with cd(config['basedir'] + projectdir):
            run('ln -sfn {0} {1}'.format(basedir+releasedir, 'current'))

        run('sudo /etc/init.d/httpd reload')
        broadcast('Swap successful')
    except SystemExit:
        with cd(basedir):
            run('mkdir -p duds')
            run('mv {0} duds'.format(releasedir))


@parallel
def load_deploy(refspec):
    role = env.roles[0]
    project_user = config['project'] + '-' + role
    projectdir = project_user + '/'
    releasedir = time.strftime(datetime_format)
    basedir = config['basedir'] + projectdir + 'releases/'
    try:
        user = run('whoami')
        broadcast('{0} is deploying {1} to {2}'.format(user, refspec, env['host']))

        with cd(basedir):
            run('mkdir {0}'.format(releasedir))
            run('git clone {0} {1}'.format(config['origin'], releasedir))

        with cd(basedir + releasedir):
            run('git checkout {0}'.format(refspec))
            run('git submodule init')
            run('git submodule update')
            run('virtualenv venv')
            with nested(
                prefix('source venv/bin/activate'),
                prefix('export PIP_DOWNLOAD_CACHE={0}shared/.pip_download_cache'.format(config['basedir'] + projectdir))
            ):
                run('pip install --allow-all-external -r requirements.txt')

            run('npm cache clean')
            run('npm install --production')
            run('grunt build')
            run('touch {0}'.format(role))

            # Upgrade ownership and permissions
            run('chgrp -R {0} .'.format(project_user))
            run('chmod -R g+w .')

        broadcast('Deploy download complete')
        return releasedir

    except SystemExit:
        with cd(basedir):
            run('mkdir -p duds')
            run('mv {0} duds'.format(releasedir))

        broadcast(':rage3: Deploy failed')

def get_basedir(role):
    projectdir = config['project'] + '-' + role + '/'
    return config['basedir'] + projectdir

def get_releasedir(role):
    return get_basedir(role) + 'releases/'

@task
def remove_duds():
    role = env.roles[0]
    releasedir = get_releasedir(role)
    with cd(releasedir):
        run('rm -rf duds/*')
        broadcast('duds/ directory emptied!')

@task
def cleanup(keep_count=3):
    role = env.roles[0]
    releasedir = get_releasedir(role)
    with cd(releasedir):
        remove_count = run("ls -1 | grep -P '\d+' | head -n -{0} | wc -l".format(keep_count))
        if remove_count:
            run("ls -1 | grep -P '\d+' | head -n -{0} | xargs rm -rf".format(keep_count))

        broadcast('{0} release directories removed. Thank you for taking out the trash!'.format(remove_count))

@task
def rollback():
    role = env.roles[0]
    basedir = get_basedir(role)
    with cd(basedir):
        currentdir = run("readlink current | awk -F/ '{print $NF}'")
        newdir = run("ls -1 releases | grep -P '\d+' | awk '$1 < {0}' | tail -n 1".format(currentdir))
        if newdir:
            run("ln -sfn {0} {1}".format(basedir + 'releases/' + newdir, 'current'))
            run("touch {0}".format(role))
            deploy_time = datetime.strptime(newdir, datetime_format)
            broadcast(":construction_worker: {0} rolled back to {1} (originally deployed @ {2})".format(env['host'], newdir, deploy_time))
        else:
            broadcast(":rage3: nothing to roll back to")

@task
def rollforward():
    role = env.roles[0]
    basedir = get_basedir(role)
    with cd(basedir):
        currentdir = run("readlink current | awk -F/ '{print $NF}'")
        newdir = run("ls -1 releases | grep -P '\d+' | awk '$1 > {0}' | head -n 1".format(currentdir))
        if newdir:
            run("ln -sfn {0} {1}".format(basedir + 'releases/' + newdir, 'current'))
            run("touch {0}".format(role))
            deploy_time = datetime.strptime(newdir, datetime_format)
            broadcast(":construction_worker: {0} rolled forward to {1} (originally deployed @ {2})".format(env['host'], newdir, deploy_time))
        else:
            broadcast(":rage3: nothing to roll forward to")

