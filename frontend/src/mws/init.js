/*    Copyright 2013 10gen Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

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
    $.each(jsonArray, function (i, jsonData) {
      $.each(jsonData, function (collection, documents) {
        if (!$.isArray(documents)) {
          console.error('Json format is incorrect, top level collection ' +
            'name ' + collection + 'does not map to an array: ' + jsonData);
        } else {
          var oldJson = condensedJson[collection] || [];
          condensedJson[collection] = oldJson.concat(documents);
        }
      });
    });
    return condensedJson;
  }

  function ensureAllRequests(ajaxOptions, callback) {
    var requests = $.map(ajaxOptions, function (options) {
      return $.ajax(options);
    });
    // When expects each promise to be passed in as an argument, but we have
    // an array, so we need to use apply.
    $.when.apply($, requests).then(function () {
      callback();
    });
  }

  var run = function () {
    mongo.util.enableConsoleProtection();
    mongo.dom.injectStylesheet(mongo.config.cssPath);

    var initUrls = [];
    var initJson = [];
    var initJsonUrls = [];
    // For now, assume a single resource id for all shells
    // Initialize all shells and grab any initialization urls
    $(mongo.config.rootElementSelector).each(function (index, shellElement) {
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
        mongo.config.keepAliveTime
      );

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

      // Get all of the remote JSON literals
      ensureAllRequests(initJsonUrls, function () {
        // Condense JSON to a single object
        initJson = condenseJsonArray(initJson);

        // Add local JSON literal to initialization requests
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

        var finishSetup = function () {
          $.each(mongo.shells, function (i, shell) {
            shell.attachInputHandler(data.res_id);
          });
        };
        if (data.is_new) {
          mongo.init.runInitializationScripts(data.res_id, finishSetup);
        } else {
          finishSetup();
        }
      });
    });
  };

  var runInitializationScripts = function(res_id, callback){
    // Send requests to all initialization urls for a res id, then call the
    // callback when all are done.
    ensureAllRequests(initializationUrls[res_id], callback);
  };

  return {
    run: run,
    runInitializationScripts: runInitializationScripts
  };
})();
