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

/* global mongo, console */
/* jshint noarg: false */
mongo.events = (function(){
  var trigger = function(shell, event, data){
    data = $.extend({shell: shell, event: event}, data);
    console.info('[' + shell.id + '] ' + event + ' triggered with data ', data);

    var handlers = shell.events;
    handlers = handlers && handlers[event];
    if (handlers){
      $.each(handlers, function(id, f){
        f(data);
      });
    }
  };

  var functionTrigger = function(shell, event, args, data){
    data = $.extend({'arguments': args}, data);
    mongo.events.trigger(shell, event, data);
  };

  var callbackTrigger = function(shell, event, result, data){
    data = $.extend({result: result}, data);
    mongo.events.trigger(shell, event, data);
  };

  var bind = function(shell, event, handler, data, filter){
    return $.Deferred(function(deferred){
      if (!shell.events){
        shell.events = {};
      }

      if (!shell.events[event]){
        shell.events[event] = {};
      }

      var wrap = function(d){
        var passedData = $.extend({}, data, d);
        if (typeof filter === 'function' && !filter.call(shell, passedData)){
          return;
        }
        if (typeof handler === 'function'){
          handler.call(shell, passedData);
        }
        deferred.resolveWith(shell, [passedData]);
      };

      if (typeof handler === 'function'){
        if (!handler.id){ handler.id = ++mongo.events._id; }
        shell.events[event][handler.id] = wrap;
      }
    }).promise();
  };

  var bindOnce = function(shell, event, handler, data, filter){
    return mongo.events.bind(shell, event, handler, data, filter).done(function(){
      mongo.events.unbind(shell, event, handler);
    });
  };

  var bindAll = function(event, handler, data, filter){
    return mongo.shells.map(function(e){
      return mongo.events.bind(e, event, handler, data, filter);
    });
  };

  var unbind = function(shell, event, handler){
    if (handler){
      if (!handler.id){
        return; // handler was never bound to function
      }
      delete shell.events[event][handler.id];
    } else {
      // unbind all handlers
      delete shell.events[event];
    }
  };

  var unbindAll = function(event, handler){
    mongo.shells.forEach(function(e){
      mongo.events.unbind(e, event, handler);
    });
  };

  return {
    trigger: trigger,
    functionTrigger: functionTrigger,
    callbackTrigger: callbackTrigger,
    bind: bind,
    bindOnce: bindOnce,
    bindAll: bindAll,
    unbind: unbind,
    unbindAll: unbindAll,
    _id: 0
  };
})();
