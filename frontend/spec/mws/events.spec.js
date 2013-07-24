/* global describe, it, jasmine, beforeEach, afterEach, mongo, spyOn, expect, CONST */
/* jshint camelcase: false */
describe('The events class', function(){
  var $shell, shell;
  beforeEach(function(){
    $shell = $('<div class=' + CONST.css.classes.root + '/>');
    $('body').append($shell);
    shell = new mongo.Shell($shell.get(0), 0);
    mongo.shells = [shell];
  });

  afterEach(function(){
    $('.' + CONST.css.classes.root).remove();
    $('iframe').remove();
  });

  it('has a trigger function that namespaces the event, ' +
     'adds the current shell to the event data, and calls through to jQuery', function(){
    spyOn($.fn, 'trigger').andCallFake(function(){
      expect(this[0]).toBe($shell[0]);
    });
    mongo.events.trigger({$rootElement: $shell}, 'event', {});
    expect($.fn.trigger).toHaveBeenCalledWith('mws:event', {shell: {$rootElement: $shell}});
  });

  it('has a functionTrigger function that adds the arguments ' +
     'to the event data and calls through to trigger', function(){
    var fn = spyOn(mongo.events, 'trigger');
    mongo.events.functionTrigger({$rootElement: $shell}, 'event', [1, 2, 3], {});
    expect(fn).toHaveBeenCalledWith({$rootElement: $shell}, 'event', {arguments: [1, 2, 3]});
  });

  it('has a callbackTrigger function that adds the result ' +
     'to the event data and calls through to trigger', function(){
    var fn = spyOn(mongo.events, 'trigger');
    mongo.events.callbackTrigger({$rootElement: $shell}, 'event', [1, 2, 3], {});
    expect(fn).toHaveBeenCalledWith({$rootElement: $shell}, 'event', {result: [1, 2, 3]});
  });

  describe('has a bind function that', function(){
    it('listens for the bound event and calls the handler with shell context and data', function(){
      var callback = function(event, data){
        expect(this).toBe(shell);
        expect(event instanceof jQuery.Event);
        expect(data.shell).toBe(shell);
      };
      mongo.events.bind(shell, 'event', callback);
      $shell.trigger('mws:event');
    });

    it('returns a promise that is resolved on first trigger', function(){
      var promise = mongo.events.bind(shell, 'event');
      expect(promise.state()).not.toEqual('resolved');
      $shell.trigger('mws:event');
      expect(promise.state()).toEqual('resolved');
    });

    it('is only triggered on the correct events', function(){
      var fn = jasmine.createSpy();
      mongo.events.bind(shell, 'target', fn);
      expect(fn).not.toHaveBeenCalled();
      $shell.trigger('target');
      $shell.trigger('mws)');
      $shell.trigger('mws.target');
      $shell.trigger('mws:something-else');
      $shell.trigger('mws:event');
      $shell.trigger('mws:target:subevent');
      expect(fn).not.toHaveBeenCalled();
      $shell.trigger('mws:target');
      expect(fn).toHaveBeenCalled();
    });

    it('is called on every occurance of the event', function(){
      var fn = jasmine.createSpy();
      mongo.events.bind(shell, 'event', fn);
      $shell.trigger('mws:event');
      $shell.trigger('mws:event');
      $shell.trigger('mws:event');
      expect(fn.callCount).toBe(3);
    });

    it('does not call the callback if the filter returns false', function(){
      var fn = jasmine.createSpy();
      mongo.events.bind(shell, 'event', fn, null, function(){ return false; });
      $shell.trigger('mws:event');
      expect(fn).not.toHaveBeenCalled();

      mongo.events.bind(shell, 'event', fn, null, function(){ return true; });
      $shell.trigger('mws:event');
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('has a bindOnce function that', function(){
    it('correctly wraps the callback function', function(){
      mongo.events.bindOnce(shell, 'event', function(event, data){
        expect(event instanceof jQuery.Event).toBe(true);
        expect(data).toEqual({shell: shell});
      });
      $shell.trigger('mws:event');
    });

    it('is only triggered once', function(){
      var fn = jasmine.createSpy();
      mongo.events.bindOnce(shell, 'event', fn);
      $shell.trigger('mws:event');
      $shell.trigger('mws:event');
      $shell.trigger('mws:event');
      expect(fn.callCount).toBe(1);
    });

    it('plays nicely with bind', function(){
      var fn = jasmine.createSpy(), fnOnce = jasmine.createSpy();
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bindOnce(shell, 'event', fnOnce);
      $shell.trigger('mws:event');
      expect(fn.callCount).toBe(1);
      expect(fnOnce.callCount).toBe(1);
      $shell.trigger('mws:event');
      expect(fn.callCount).toBe(2);
      expect(fnOnce.callCount).toBe(1);
    });
  });

  describe('has a bindAll function that', function(){
    var $shell2, shell2, fn;
    beforeEach(function(){
      $shell2 = $('<div class=' + CONST.css.classes.root + '/>');
      $('body').append($shell2);
      shell2 = new mongo.Shell($shell2.get(0), 0);
      mongo.shells.push(shell2);
      fn = jasmine.createSpy();
      mongo.events.bindAll('event', fn);
    });

    it('binds to all shells', function(){
      $shell.trigger('mws:event');
      $shell2.trigger('mws:event');
      $shell.trigger('mws:event');
      $shell2.trigger('mws:event');
      expect(fn.callCount).toBe(4);
    });

    it('passes the correct shell in the data', function(){
      $shell.trigger('mws:event');
      expect(fn.mostRecentCall.args[1]).toEqual({shell: shell});
      $shell2.trigger('mws:event');
      expect(fn.mostRecentCall.args[1]).toEqual({shell: shell2});
    });
  });

  describe('has an unbind function that', function(){
    it('unbinds all handlers', function(){
      var fn = jasmine.createSpy();
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bindOnce(shell, 'event', fn);
      $shell.trigger('mws:event');
      expect(fn.callCount).toBe(2);

      mongo.events.bindOnce(shell, 'event', fn);
      mongo.events.unbind(shell, 'event');
      $shell.trigger('mws:event');
      expect(fn.callCount).toBe(2);
    });

    it('unbinds the specified handler', function(){
      var fn = jasmine.createSpy(), fn2 = jasmine.createSpy();
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bind(shell, 'event', fn2);
      $shell.trigger('mws:event');
      expect(fn.callCount).toBe(1);
      expect(fn2.callCount).toBe(1);

      mongo.events.unbind(shell, 'event', fn2);
      $shell.trigger('mws:event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(1);
    });
  });

  describe('has an unbindAll function that', function(){
    var $shell2, shell2, fn, fn2;
    beforeEach(function(){
      $shell2 = $('<div class=' + CONST.css.classes.root + '/>');
      $('body').append($shell2);
      shell2 = new mongo.Shell($shell2.get(0), 0);
      mongo.shells.push(shell2);
      fn = jasmine.createSpy(), fn2 = jasmine.createSpy();
    });

    it('unbinds all handlers on all shells', function(){
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bindOnce(shell, 'event', fn2);
      mongo.events.bind(shell2, 'event', fn);
      mongo.events.bindOnce(shell2, 'event', fn2);
      $shell.trigger('mws:event');
      $shell2.trigger('mws:event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(2);

      mongo.events.bindOnce(shell, 'event', fn);
      mongo.events.bindOnce(shell2, 'event', fn);
      mongo.events.unbindAll('event');
      $shell.trigger('mws:event');
      $shell2.trigger('mws:event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(2);
    });

    it('unbinds the specified handler on all shells', function(){
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bindOnce(shell, 'event', fn2);
      mongo.events.bind(shell2, 'event', fn2);
      mongo.events.bindOnce(shell2, 'event', fn);
      $shell.trigger('mws:event');
      $shell2.trigger('mws:event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(2);

      mongo.events.unbindAll('event', fn2);
      $shell.trigger('mws:event');
      $shell2.trigger('mws:event');
      expect(fn.callCount).toBe(3);
      expect(fn2.callCount).toBe(2);
    });
  });
});
