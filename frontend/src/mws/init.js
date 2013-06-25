/* jshint camelcase: false */
/* global mongo */
/**
 * Injects a mongo web shell into the DOM wherever an element of class
 * 'mongo-web-shell' can be found. Additionally sets up the resources
 * required by the web shell, including the mws REST resource and the mws
 * CSS stylesheets.
 */
mongo.init = function () {
  mongo.util.enableConsoleProtection();
  var config = mongo.config = mongo.dom.retrieveConfig();
  mongo.dom.injectStylesheet(config.cssPath);
  // For now, assume a single resource id for all shells
  // Initialize all shells
  $(mongo.const.rootElementSelector).each(function (index, shellElement) {
    mongo.shells[index] = new mongo.Shell(shellElement, index);
  });
  // Request a resource ID, give it to all the shells, and keep it alive
  mongo.request.createMWSResource(mongo.shells, function (data) {
    $.each(mongo.shells, function (i, shell) {
      shell.attachInputHandler(data.res_id);
    });
    setInterval(
      function () { mongo.request.keepAlive(data.res_id); },
      mongo.const.keepAliveTime
    );
  });
};
