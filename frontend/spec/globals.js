/* exported CONST */
/**
 * This file contains various global variables that are used throughout
 * testing.
 */
$.ready = function () {}; // Prevent mongo.init() from running.

var CONST = {
  rootClass: 'mongo-web-shell',
  domConfig: {
    dataAttrKeys: {
      cssPath: 'css-path',
      mwsHost: 'mws-host'
    },
    defaults: {
      cssPath: 'mongoWebShell.css',
      mwsHost: '',
      baseUrlPostfix: '/mws/'
    }
  },
  scriptName: 'mongoWebShell.js'
};
