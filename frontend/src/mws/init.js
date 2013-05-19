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
  $(mongo.const.rootElementSelector).each(function (index, shellElement) {
    var shell = new mongo.Shell(shellElement, index);
    mongo.shells[index] = shell;
    shell.injectHTML();
    shell.attachClickListener();
    mongo.request.createMWSResource(shell, function (data) {
      shell.attachInputHandler(data.res_id);
      shell.enableInput(true);
      setInterval(function () { shell.keepAlive(); },
          mongo.const.keepAliveTime);
    });
  });
};
