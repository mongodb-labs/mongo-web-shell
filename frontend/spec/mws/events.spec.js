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

/* global describe, it, jasmine, beforeEach, afterEach, mongo, spyOn, expect, CONST */
/* jshint camelcase: false */
describe('The events class', function(){
  var $shell, shell, fn, fn2;
  beforeEach(function(){
    $shell = $('<div class=' + CONST.rootClass + '/>');
    $('body').append($shell);
    shell = new mongo.Shell($shell[0], 0);
    mongo.shells = [shell];
    fn = jasmine.createSpy(), fn2 = jasmine.createSpy();
  });

  afterEach(function(){
    $('.' + CONST.rootClass).remove();
    $('iframe').remove();
  });

  describe('can trigger events with', function(){
    beforeEach(function(){
      shell.events = {event: {1: fn, 2: fn2}};
    });

    afterEach(function(){
      $shell.events = {};
    });

    it('a trigger function that adds the current shell to the event data ' +
       'and calls attached handlers on the shell', function(){
      mongo.events.trigger(shell, 'event', {extra: 123});
      var expected = {shell: shell, event: 'event', extra: 123};
      expect(fn).toHaveBeenCalledWith(expected);
      expect(fn2).toHaveBeenCalledWith(expected);
    });

    it('a functionTrigger function that adds the arguments ' +
       'to the event data and calls through to trigger', function(){
      var fn = spyOn(mongo.events, 'trigger');
      mongo.events.functionTrigger(shell, 'event', [1, 2, 3], {});
      expect(fn).toHaveBeenCalledWith(shell, 'event', {arguments: [1, 2, 3]});
    });

    it('a callbackTrigger function that adds the result ' +
       'to the event data and calls through to trigger', function(){
      var fn = spyOn(mongo.events, 'trigger');
      mongo.events.callbackTrigger(shell, 'event', [1, 2, 3], {});
      expect(fn).toHaveBeenCalledWith(shell, 'event', {result: [1, 2, 3]});
    });
  });

  describe('has a bind function that', function(){
    beforeEach(function(){
      mongo.events._id = 0;
    });

    afterEach(function(){
      shell.events = {};
    });

    it('can bind and unbind immediately', function () {
      mongo.events.bind(shell, 'event', fn);
      mongo.events.unbind(shell, 'event', fn);
      mongo.events.trigger(shell, 'event');
      expect(fn).not.toHaveBeenCalled();
    });

    it('wraps and inserts the event handlers into the shell\'s event queue', function(){
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bind(shell, 'event', fn2);
      expect(fn).not.toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
      shell.events.event[1]();
      expect(fn).toHaveBeenCalled();
      expect(fn2).not.toHaveBeenCalled();
      shell.events.event[2]();
      expect(fn2).toHaveBeenCalled();
    });

    it('returns a promise that is resolved on first trigger', function(){
      var promise = mongo.events.bind(shell, 'event', function(){});
      expect(promise.state()).not.toEqual('resolved');
      mongo.events.trigger(shell, 'event');
      expect(promise.state()).toEqual('resolved');
    });

    it('is only triggered on the correct events', function(){
      var fn = jasmine.createSpy();
      mongo.events.bind(shell, 'target', fn);
      expect(fn).not.toHaveBeenCalled();
      mongo.events.trigger(shell, 'something-else');
      mongo.events.trigger(shell, 'target.subevent');
      mongo.events.trigger(shell, 'event.target');
      expect(fn).not.toHaveBeenCalled();
      mongo.events.trigger(shell, 'target');
      expect(fn).toHaveBeenCalled();
    });

    it('is called on every occurance of the event', function(){
      var fn = jasmine.createSpy();
      mongo.events.bind(shell, 'event', fn);
      for (var i = 0; i < 3; i++){ mongo.events.trigger(shell, 'event'); }
      expect(fn.callCount).toBe(3);
    });

    it('does not call the callback if the filter returns false', function(){
      mongo.events.bind(shell, 'event', fn, null, function(){ return false; });
      mongo.events.trigger(shell, 'event');
      expect(fn).not.toHaveBeenCalled();

      mongo.events.bind(shell, 'event', fn, null, function(){ return true; });
      mongo.events.trigger(shell, 'event');
      expect(fn).toHaveBeenCalled();
    });

    it('checks the filter with the correct arguments', function(){
      var filter = jasmine.createSpy().andCallFake(function(){
        expect(arguments[0].extra).toEqual(123);
        expect(arguments.length).toBe(1);
        expect(this).toBe(shell);
      });

      mongo.events.bind(shell, 'event', fn, {extra: 123}, filter);
      mongo.events.trigger(shell, 'event');
      expect(filter).toHaveBeenCalledWith({shell: shell, event: 'event', extra: 123});
    });
  });

  describe('has a bindOnce function that', function(){
    it('correctly wraps the callback function', function(){
      var handler = jasmine.createSpy();
      mongo.events.bindOnce(shell, 'event', handler);
      mongo.events.trigger(shell, 'event');
      expect(handler).toHaveBeenCalledWith({shell: shell, event: 'event'});
    });

    it('is only triggered once', function(){
      mongo.events.bindOnce(shell, 'event', fn);
      for (var i = 0; i < 3; i++){ mongo.events.trigger(shell, 'event'); }
      expect(fn.callCount).toBe(1);
    });

    it('plays nicely with bind', function(){
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bindOnce(shell, 'event', fn2);
      mongo.events.trigger(shell, 'event');
      expect(fn.callCount).toBe(1);
      expect(fn2.callCount).toBe(1);
      mongo.events.trigger(shell, 'event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(1);
    });
  });

  describe('has a bindAll function that', function(){
    var $shell2, shell2;
    beforeEach(function(){
      $shell2 = $('<div class=' + CONST.rootClass + '/>');
      $('body').append($shell2);
      shell2 = new mongo.Shell($shell2[0], 0);
      mongo.shells.push(shell2);
      mongo.events.bindAll('event', fn);
    });

    it('binds to all shells', function(){
      mongo.events.trigger(shell, 'event');
      mongo.events.trigger(shell2, 'event');
      mongo.events.trigger(shell, 'event');
      mongo.events.trigger(shell2, 'event');
      expect(fn.callCount).toBe(4);
    });

    it('passes the correct shell in the data', function(){
      mongo.events.trigger(shell, 'event');
      expect(fn.mostRecentCall.args[0]).toEqual({shell: shell, event: 'event'});
      mongo.events.trigger(shell2, 'event');
      expect(fn.mostRecentCall.args[0]).toEqual({shell: shell2, event: 'event'});
    });
  });

  describe('has an unbind function that', function(){
    it('unbinds all handlers', function(){
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bindOnce(shell, 'event', fn2);
      mongo.events.trigger(shell, 'event');
      expect(fn.callCount).toBe(1);
      expect(fn2.callCount).toBe(1);

      mongo.events.bindOnce(shell, 'event', fn2);
      mongo.events.unbind(shell, 'event');
      mongo.events.trigger(shell, 'event');
      expect(fn.callCount).toBe(1);
      expect(fn2.callCount).toBe(1);
    });

    it('unbinds the specified handler', function(){
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bind(shell, 'event', fn2);
      mongo.events.trigger(shell, 'event');
      expect(fn.callCount).toBe(1);
      expect(fn2.callCount).toBe(1);

      mongo.events.unbind(shell, 'event', fn2);
      mongo.events.trigger(shell, 'event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(1);

      mongo.events.bindOnce(shell, 'event', fn2);
      mongo.events.unbind(shell, 'event', fn2);
      mongo.events.trigger(shell, 'event');
      expect(fn2.callCount).toBe(1);
    });
  });

  describe('has an unbindAll function that', function(){
    var $shell2, shell2;
    beforeEach(function(){
      $shell2 = $('<div class=' + CONST.rootClass + '/>');
      $('body').append($shell2);
      shell2 = new mongo.Shell($shell2.get(0), 0);
      mongo.shells.push(shell2);
    });

    it('unbinds all handlers on all shells', function(){
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bindOnce(shell, 'event', fn2);
      mongo.events.bind(shell2, 'event', fn);
      mongo.events.bindOnce(shell2, 'event', fn2);
      mongo.events.trigger(shell, 'event');
      mongo.events.trigger(shell2, 'event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(2);

      mongo.events.bindOnce(shell, 'event', fn);
      mongo.events.bindOnce(shell2, 'event', fn);
      mongo.events.unbindAll('event');
      mongo.events.trigger(shell, 'event');
      mongo.events.trigger(shell2, 'event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(2);
    });

    it('unbinds the specified handler on all shells', function(){
      mongo.events.bind(shell, 'event', fn);
      mongo.events.bindOnce(shell, 'event', fn2);
      mongo.events.bind(shell2, 'event', fn2);
      mongo.events.bindOnce(shell2, 'event', fn);
      mongo.events.trigger(shell, 'event');
      mongo.events.trigger(shell2, 'event');
      expect(fn.callCount).toBe(2);
      expect(fn2.callCount).toBe(2);

      mongo.events.unbindAll('event', fn2);
      mongo.events.trigger(shell, 'event');
      mongo.events.trigger(shell2, 'event');
      expect(fn.callCount).toBe(3);
      expect(fn2.callCount).toBe(2);
    });
  });
});

