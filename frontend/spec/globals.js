/* exported CONST */
/**
 * This file contains various global variables that are used throughout
 * testing.
 */
$.ready = function () {}; // Prevent mongo.init() from running.

var CONST = {
  css: {
    classes: {
      root: 'mongo-web-shell',
      internal: [
        'mws-response-list',
        'mws-input-li',
        'mws-form',
        'mws-input'
      ],
      responseList: 'mws-response-list'
    }
  },
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
