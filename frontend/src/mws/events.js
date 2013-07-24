/* global mongo, console */
/* jshint noarg: false */
mongo.events = (function(){
  var id = 0;
  var handlers = {};

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

      var wrap = function(event){
        if (typeof filter === 'function' && !filter(shell, event, data)){
          return;
        }
        if (typeof handler === 'function'){
          handler.call(shell, event, data);
        }
        deferred.resolveWith(shell, [event, data]);
      };

      if (typeof handler === 'function' && !handler.id){
        handler.id = ++id;
        handlers[handler.id] = wrap;
      }

      $(shell.$rootElement).bind('mws:' + event, data, wrap);
    }).promise();
  };

  var bindOnce = function(shell, event, handler, data, filter){
    data = $.extend({shell: shell}, data);
    var wrappedHandler = function(){
      handler.apply(shell, arguments);
      mongo.events.unbind(shell, event, arguments.callee.caller);
    };
    return mongo.events.bind(shell, event, wrappedHandler, data, filter);
  };

  var bindAll = function(event, handler, data, filter){
    return mongo.shells.map(function(e){
      return mongo.events.bind(e, event, handler, data, filter);
    });
  };

  var unbind = function(shell, event, handler){
    if (handler && handler.id){ handler = handlers[handler.id]; }
    $(shell.$rootElement).unbind('mws:' + event, handler);
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
    unbindAll: unbindAll
  };
})();
