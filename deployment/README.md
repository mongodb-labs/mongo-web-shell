## Description

This is a sample [Ansible](http://www.ansibleworks.com/) configuration for a simple deployment.

## Instructions

These instruction assume you have a machine called `mws` setup. It doesn't matter whether this is a cloud machine, VM, or bare-metal box. You are strongly advised to skip this section and use Vagrant Instructions unless you want to do a production deployment.

1. Install [Ansible](http://www.ansibleworks.com/) (at least version 1.3.2).
2. Add `mws` to your `/etc/hosts` or `~/.ssh/config` file with the appropriate IP address and connection info if necessary.
3. Create vars.yml based off vars.sample.yml
4. Run `ansible-playbook -i inventory site.yml`.
5. Once this is finished, `mws` will be running the `service`, `ivs`, and `ivp` webapps.
