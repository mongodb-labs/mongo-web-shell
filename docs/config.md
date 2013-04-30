Configuration
=============
The default app configuration files can be found in mongows/configs/. These
configurations can be overridden with environment variables (see below).

Environment Variables
---------------------
* __DEBUG__: Debug mode is enabled if it is set to any value but the empty
  string.
* __HOST__: The host the Flask web server should listen on.
* __LOGGING_CONF__: The path to the desired logging configuration file.
* __MONGOHQ_URL__: The url of a running mongod instance.
* __NO_SAMPLE__: Disables the the sample (route: /sample/) if set to any value
  but the empty string.
* __PORT__: The port the web shell service should run on.
