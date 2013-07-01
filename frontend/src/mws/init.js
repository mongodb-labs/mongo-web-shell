/* jshint camelcase: false */
/* global mongo, console */
/**
 * Injects a mongo web shell into the DOM wherever an element of class
 * 'mongo-web-shell' can be found. Additionally sets up the resources
 * required by the web shell, including the mws REST resource, the mws
 * CSS stylesheets, and calls any initialization urls
 */
mongo.init = (function(){
  var initializationUrls = {};

  var run = function () {
    mongo.util.enableConsoleProtection();
    var config = mongo.config = mongo.dom.retrieveConfig();
    mongo.dom.injectStylesheet(config.cssPath);

    var initUrls = [];
    var initJsons = [];
    // For now, assume a single resource id for all shells
    // Initialize all shells and grab any initialization urls
    $(mongo.const.rootElementSelector).each(function (index, shellElement) {
      var initUrl = shellElement.getAttribute('data-initialization-url');
      if (initUrl) {
        initUrls.push(initUrl);
      }
      var initJson = shellElement.getAttribute('data-initialization-json');
      if (initJson) {
        try {
          initJsons.push(JSON.parse(initJson));
        } catch (e) {
          console.error('Unable to parse initialization json: ' + initJson);
        }
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

    // Condense JSON to a single object
    // The JSON should be a top level object in which the keys are collection
    // names which map to an array of documents which are to be inserted into
    // the specified collection.
    var condensedJson = {};
    for (var j = 0; j < initJsons.length; j++) {
      var initJson = initJsons[j];
      for (var collection in  initJson) {
        if (initJson.hasOwnProperty(collection)) {
          if (!$.isArray(initJson[collection])) {
            console.error('Json format is incorrect, top level collection ' +
              'name ' + collection + 'does not map to an array: ' + initJson);
            continue;
          }
          if (!condensedJson.hasOwnProperty(collection)) {
            condensedJson[collection] = [];
          }
          condensedJson[collection] = condensedJson[collection].concat(initJson[collection]);
        }
      }
    }

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

      if (Object.keys(condensedJson).length > 0) {
        initUrls.push([
          '/init/load_json',
          {collections: condensedJson}
        ]);
      }
      initializationUrls[data.res_id] = initUrls;

      if (data.is_new){
        mongo.init.runInitializationScripts(data.res_id, finishSetup);
      } else {
        finishSetup();
      }
    });
  };

  var runInitializationScripts = function(res_id, callback){
    var initUrls = initializationUrls[res_id];
    if (initUrls.length !== 0){
      // Handle multiple initialization urls. Need to make sure all requests have
      // finished before we call finish setup
      var doneCount = 0;
      var ensureAllRequestsDone = function(){
        doneCount++;
        if (doneCount === initUrls.length){
          callback();
        }
      };
      $.each(initUrls, function (i, url){
        var data = {};
        if ($.isArray(url)) {
          data = url[1] || {};
          url = url[0];
        }
        data.res_id = res_id;
        $.ajax({
          type: 'POST',
          url: url,
          data: JSON.stringify(data),
          contentType: 'application/json',
          success: ensureAllRequestsDone
        });
      });
    } else {
      callback();
    }
  };

  return {
    run: run,
    runInitializationScripts: runInitializationScripts
  };
})();
