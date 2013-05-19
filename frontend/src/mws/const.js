/* global mongo */
mongo.const = (function () {
  var KEYCODES = {
    enter: 13,
    left: 37,
    up: 38,
    right: 39,
    down: 40
  };

  return {
    keycodes: KEYCODES,
    keepAliveTime: 30000,
    rootElementSelector: '.mongo-web-shell',
    scriptName: 'mongoWebShell.js',
    shellBatchSize: 20
  };
}());
