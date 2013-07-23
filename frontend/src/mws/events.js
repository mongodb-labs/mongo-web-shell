/* global mongo, console */
/* jshint noarg: false */
mongo.events = (function(){
  var trigger = function(shell, event, data){
    data = $.extend({shell: shell}, data);
    console.info('[' + shell.id + '] ' + event + ' triggered with data ', data);
    $(shell.$rootElement).trigger('mws:' + event, data);
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
      data = $.extend({shell: shell}, data);
      $(shell.$rootElement).bind('mws:' + event, data, function(event){
        if (typeof filter === 'function' && !filter(shell, event, data)){
          return;
        }
        if (typeof handler === 'function'){
          handler.call(shell, event, data);
        }
        deferred.resolveWith(shell, [event, data]);
      });
    }).promise();
  };

  var bindOnce = function(shell, event, handler, data, filter){
    data = $.extend({shell: shell}, data);
    var wrappedHandler = function(){
      handler.apply(shell, arguments);
      $(shell.$rootElement).unbind('mws:' + event, arguments.callee.caller);
    };
    return mongo.events.bind(shell, event, wrappedHandler, data, filter);
  };

  var bindAll = function(event, handler, data, filter){
    return mongo.shells.map(function(e){
      return mongo.events.bind(e, event, handler, data, filter);
    });
  };

  return {
    trigger: trigger,
    functionTrigger: functionTrigger,
    callbackTrigger: callbackTrigger,
    bind: bind,
    bindOnce: bindOnce,
    bindAll: bindAll
  };
})();
