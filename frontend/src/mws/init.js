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
  var loadUrl = function(url, res_id){
    return $.ajax({
      type: 'POST',
      url: url,
      data: JSON.stringify({res_id: res_id}),
      contentType: 'application/json'
    });
  };

  var loadJSON = function(initJson, res_id){
    if (Object.keys(initJson).length > 0) {
      return $.ajax({
        type: 'POST',
        url: '/init/load_json',
        data: JSON.stringify({
          res_id: res_id,
          collections: initJson
        }),
        contentType: 'application/json'
      });
    }
  };

  var loadJSONUrl = function(url, res_id){
    return $.getJSON(url).then(function(data){
      return mongo.init._loadJSON(data, res_id);
    }, function(){
      return $.Deferred().rejectWith($, arguments).promise();
    });
  };

  var lockShells = function(res_id){
    if (!mongo.init._initState[res_id]){
      mongo.init._initState[res_id] = {
        pending: 1,
        initUrls: [],
        initJsonUrls: []
      };
    } else {
      mongo.init._initState[res_id].pending++;
    }

    // Lock all affected shells with same res_id
    // Note that this is currently ALL shells since we do not yet assign
    // unique res_ids and all shells share the same res_id
    $.each(mongo.shells, function(i, e){
      e.enableInput(false);
    });
  };

  // unlock shells when all init steps for all shells with res_id are complete
  // can optionally wait for one or more deferred objects to resolve
  // see note above regarding all shells having same res_id
  var unlockShells = function(res_id, waitFor){
    $.when.apply($, waitFor).then(function(){
      mongo.init._initState[res_id].pending--;
      if (!mongo.init._initState[res_id].pending){
        $.each(mongo.shells, function(i, e){
          e.enableInput(true);
        });
      }
    }, function(){
      mongo.init._initState[res_id].pending--;
      if (!mongo.init._initState[res_id].pending){
        $.each(mongo.shells, function(i, e){
          e.insertResponseArray([
            'One or more scripts failed during initialization.',
            'Your data may not be completely loaded.  Use the "reset" command to try again.'
          ]);
          e.enableInput(true);
        });
      }
    });
  };

  var initShell = function(shellElement, res_id, options){
    var create_new = options.create_new, init_data = options.init_data;
    var waitFor = [];

    if (create_new){
      var shell = new mongo.Shell(shellElement, mongo.shells.length);
      shell.attachInputHandler(res_id);
      mongo.shells.push(shell);
    }

    if (init_data){
      // lock shells for init
      lockShells(res_id);

      // Load init urls
      var initUrl = options.init_url || $(shellElement).data('initialization-url');
      if (initUrl && mongo.init._initState[res_id].initUrls.indexOf(initUrl) === -1) {
        mongo.init._initState[res_id].initUrls.push(initUrl);
        waitFor.push(loadUrl(initUrl, res_id));
      }

      // Load init JSON/urls
      var jsonAttr = options.init_json || $(shellElement).data('initialization-json');
      if (typeof jsonAttr === 'object'){
        waitFor.push(loadJSON(jsonAttr, res_id));
      } else if (jsonAttr && jsonAttr[0] === '{' && jsonAttr[jsonAttr.length - 1] === '}') {
        // If it looks like a JSON object, assume it is supposed to be and try to parse it
        try {
          waitFor.push(loadJSON(JSON.parse(jsonAttr), res_id));
        } catch (e) {
          console.error('Unable to parse initialization json: ' + jsonAttr);
        }
      } else if (jsonAttr &&
                 mongo.init._initState[res_id].initJsonUrls.indexOf(jsonAttr) === -1) {
        // Otherwise assume it's a URL that points to JSON data
        mongo.init._initState[res_id].initJsonUrls.push(jsonAttr);
        waitFor.push(loadJSONUrl(jsonAttr, res_id));
      }

      unlockShells(res_id, waitFor);
    }
  };

  var run = function () {
    mongo.jQueryInit(jQuery);
    mongo.util.enableConsoleProtection();
    var config = mongo.config = mongo.dom.retrieveConfig();
    mongo.dom.injectStylesheet(config.cssPath);


    // Request a resource ID, give it to all the shells, and keep it alive
    mongo.request.createMWSResource(mongo.shells, function (data) {
      mongo.init.res_id = data.res_id;

      setInterval(
        function () { mongo.request.keepAlive(data.res_id); },
        mongo.const.keepAliveTime
      );

      // For now, assume a single resource id for all shells
      // Initialize all shells and process initialization urls
      $(mongo.const.rootElementSelector).mws({create_new: true, init_data: data.is_new});
    });
  };

  return {
    run: run,
    _initState: {},
    _lockShells: lockShells,
    _unlockShells: unlockShells,
    _initShell: initShell,
    _loadJSON: loadJSON,
    _loadJSONUrl: loadJSONUrl,
    res_id: null
  };
})();
