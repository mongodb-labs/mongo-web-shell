/* jshint camelcase: false */
/* global mongo, console */
/**
 * Injects a mongo web shell into the DOM wherever an element of class
 * 'mongo-web-shell' can be found. Additionally sets up the resources
 * required by the web shell, including the mws REST resource, the mws
 * CSS stylesheets, and calls any initialization urls
 */
mongo.init = (function(){
  // This file is getting pretty bogged down in callbacks. I spent the better
  // part of a day thinking about how to clean it up and make it more
  // maintainable and extensible, but this was the best I could come up with.
  //  - Danny
  var initializationUrls = {};

  function uniqueArray(original) {
    // Taken from http://stackoverflow.com/a/1961068
    var seen = {}, unique = [];
    for (var i = 0, l = original.length; i < l; ++i) {
      if (seen.hasOwnProperty(original[i])) {
        continue;
      }
      unique.push(original[i]);
      seen[original[i]] = 1;
    }
    return unique;
  }

  function condenseJsonArray(jsonArray) {
    // Each JSON should be a top level object in which the keys are collection
    // names which map to an array of documents which are to be inserted into
    // the specified collection.
    var condensedJson = {};
    for (var j = 0; j < jsonArray.length; j++) {
      var jsonData = jsonArray[j];
      for (var collection in  jsonData) {
        if (jsonData.hasOwnProperty(collection)) {
          if (!$.isArray(jsonData[collection])) {
            console.error('Json format is incorrect, top level collection ' +
              'name ' + collection + 'does not map to an array: ' + jsonData);
            continue;
          }
          if (!condensedJson.hasOwnProperty(collection)) {
            condensedJson[collection] = [];
          }
          condensedJson[collection] = condensedJson[collection].concat(jsonData[collection]);
        }
      }
    }
    return condensedJson;
  }

  function ensureAllRequests(ajaxOptions, callback) {
    if (ajaxOptions.length === 0) {
      callback();
    } else {
      var doneCount = 0;
      var ensureAllRequestsDone = function(){
        doneCount++;
        if (doneCount === ajaxOptions.length){
          callback();
        }
      };
      $.each(ajaxOptions, function (i, options){
        var oldSuccess = options.success;
        options.success = function (data) {
          if (oldSuccess) {
            oldSuccess(data);
          }
          ensureAllRequestsDone();
        };
        $.ajax(options);
      });
    }
  }

  var run = function () {
    mongo.util.enableConsoleProtection();
    var config = mongo.config = mongo.dom.retrieveConfig();
    mongo.dom.injectStylesheet(config.cssPath);

    var initUrls = [];
    var initJson = [];
    var initJsonUrls = [];
    // For now, assume a single resource id for all shells
    // Initialize all shells and grab any initialization urls
    $(mongo.const.rootElementSelector).each(function (index, shellElement) {
      var initUrl = shellElement.getAttribute('data-initialization-url');
      if (initUrl) {
        initUrls.push(initUrl);
      }
      var jsonAttr = shellElement.getAttribute('data-initialization-json');
      if (jsonAttr && jsonAttr[0] === '{' && jsonAttr[jsonAttr.length - 1] === '}') {
        // If it looks like a JSON object, assume it is supposed to be and try to parse it
        try {
          initJson.push(JSON.parse(jsonAttr));
        } catch (e) {
          console.error('Unable to parse initialization json: ' + jsonAttr);
        }
      } else if (jsonAttr) {
        // Otherwise assume it's a URL that points to JSON data
        initJsonUrls.push(jsonAttr);
      }
      mongo.shells[index] = new mongo.Shell(shellElement, index);
    });

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

      // Need to make sure that urls are unique and converted to $.ajax options
      initUrls = $.map(uniqueArray(initUrls), function (url) {
        return {
          type: 'POST',
          url: url,
          data: JSON.stringify({res_id: data.res_id}),
          contentType: 'application/json'
        };
      });
      initJsonUrls = $.map(uniqueArray(initJsonUrls), function (url) {
        return {
          type: 'GET',
          url: url,
          success: function (data) {
            if (typeof (data) === 'string') {
              data = JSON.parse(data);
            }
            initJson.push(data);
          }
        };
      });

      ensureAllRequests(initJsonUrls, function () {
        // Condense JSON to a single object
        initJson = condenseJsonArray(initJson);

        // Add local json literal to initialization requests
        if (Object.keys(initJson).length > 0) {
          initUrls.push({
            type: 'POST',
            url: '/init/load_json',
            data: JSON.stringify({
              res_id: data.res_id,
              collections: initJson
            }),
            contentType: 'application/json'
          });
        }
        initializationUrls[data.res_id] = initUrls;

        if (data.is_new) {
          mongo.init.runInitializationScripts(data.res_id, finishSetup);
        } else {
          finishSetup();
        }
      });
    });
  };

  var runInitializationScripts = function(res_id, callback){
    ensureAllRequests(initializationUrls[res_id], callback);
  };

  return {
    run: run,
    runInitializationScripts: runInitializationScripts
  };
})();
