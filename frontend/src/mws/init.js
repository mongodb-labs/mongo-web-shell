/* jshint camelcase: false */
/* global mongo */
/**
 * Injects a mongo web shell into the DOM wherever an element of class
 * 'mongo-web-shell' can be found. Additionally sets up the resources
 * required by the web shell, including the mws REST resource, the mws
 * CSS stylesheets, and calls any initialization urls
 */
mongo.init = function () {
  mongo.util.enableConsoleProtection();
  var config = mongo.config = mongo.dom.retrieveConfig();
  mongo.dom.injectStylesheet(config.cssPath);

  var initUrls = [];
  // For now, assume a single resource id for all shells
  // Initialize all shells and grab any initialization urls
  $(mongo.const.rootElementSelector).each(function (index, shellElement) {
    var initUrl = shellElement.getAttribute('data-initialization-url');
    if (initUrl) {
      initUrls.push(initUrl);
    }
    mongo.shells[index] = new mongo.Shell(shellElement, index);
  });

  // Need to make sure that urls are unique
  // Taken from http://stackoverflow.com/a/1961068
  var seen = {}, unique = [];
  for(var i = 0, l = initUrls.length; i < l; ++i){
    if(seen.hasOwnProperty(initUrls[i])) {
      continue;
    }
    unique.push(initUrls[i]);
    seen[initUrls[i]] = 1;
  }
  initUrls = unique;

  // Request a resource ID, give it to all the shells, and keep it alive
  mongo.request.createMWSResource(mongo.shells, function (data) {
    setInterval(
      function () { mongo.request.keepAlive(data.res_id); },
      mongo.const.keepAliveTime
    );

    var finishSetup = function () {
      $.each(mongo.shells, function (i, shell) {
        shell.attachInputHandler(data.res_id);
      });
    };

    if (initUrls.length !== 0 && data.is_new) {
      // Handle multiple initialization urls. Need to make sure all requests have
      // finished before we call finish setup
      var doneCount = 0;
      var ensureAllRequestsDone = function () {
        doneCount++;
        if (doneCount === initUrls.length) {
          finishSetup();
        }
      };
      $.each(initUrls, function (i, url) {
        $.post(url, {res_id: data.res_id}, ensureAllRequestsDone);
      });
    } else {
      finishSetup();
    }
  });
};
