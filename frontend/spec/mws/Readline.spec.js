/* global afterEach, beforeEach, describe, expect, it, mongo, spyOn, jasmine, localStorage:true */
describe('A Readline instance', function () {
  var $input, instance;

  beforeEach(function () {
    mongo.const.shellHistoryKey = 'temporary_key';
    delete localStorage[mongo.const.shellHistoryKey];
    $input = $(document.createElement('input'));
    instance = new mongo.Readline($input);
  });

  afterEach(function () {
    $input = null;
    instance = null;
    delete localStorage[mongo.const.shellHistoryKey];
  });

  it('registers a keydown handler', function () {
    spyOn(instance, 'keydown');
    $input.trigger('keydown');
    expect(instance.keydown).toHaveBeenCalled();
  });

  describe('listening for keystrokes', function () {
    var AFTER = 'after';
    var BEFORE = 'before';
    var KEYCODES = {up: 0, down: 1, enter: 2};
    var constStore;

    beforeEach(function () {
      constStore = mongo.const;
      mongo.const = {keycodes: KEYCODES};
      $input.val(BEFORE);
    });

    afterEach(function () {
      mongo.const = constStore;
      $input.val('');
    });

    // When adding additional keys, be sure to update the other keys' 'only'
    // methods.
    describe('that are the down arrow', function () {
      var EVENT = {keyCode: KEYCODES.down};

      it('only gets a newer history entry', function () {
        spyOn(instance, 'getNewerHistoryEntry');
        spyOn(instance, 'getOlderHistoryEntry');
        spyOn(instance, 'submit');
        instance.keydown(EVENT);
        expect(instance.getNewerHistoryEntry).toHaveBeenCalled();
        expect(instance.getOlderHistoryEntry).not.toHaveBeenCalled();
        expect(instance.submit).not.toHaveBeenCalled();
      });

      it('clears the input when returning a string', function () {
        var moveCursorToEnd = spyOn(instance, 'moveCursorToEnd');
        spyOn(instance, 'getNewerHistoryEntry').andReturn(AFTER);
        instance.keydown(EVENT);
        expect($input.val()).toBe(AFTER);
        expect(moveCursorToEnd).toHaveBeenCalled();
      });

      it('does not clear the input when returning undefined', function () {
        spyOn(instance, 'getNewerHistoryEntry').andReturn(undefined);
        instance.keydown(EVENT);
        expect($input.val()).toBe(BEFORE);
      });
    });

    describe('that are the up arrow', function () {
      var EVENT = {keyCode: KEYCODES.up};

      it('only gets an older history entry', function () {
        spyOn(instance, 'getNewerHistoryEntry');
        spyOn(instance, 'getOlderHistoryEntry');
        spyOn(instance, 'submit');
        instance.keydown(EVENT);
        expect(instance.getNewerHistoryEntry).not.toHaveBeenCalled();
        expect(instance.getOlderHistoryEntry).toHaveBeenCalled();
        expect(instance.submit).not.toHaveBeenCalled();
      });

      it('clears the input when returning a string', function () {
        var moveCursorToEnd = spyOn(instance, 'moveCursorToEnd');
        spyOn(instance, 'getOlderHistoryEntry').andReturn(AFTER);
        instance.keydown(EVENT);
        expect($input.val()).toBe(AFTER);
        expect(moveCursorToEnd).toHaveBeenCalled();
      });

      it('does not clear the input when returning undefined', function () {
        spyOn(instance, 'getOlderHistoryEntry').andReturn(undefined);
        instance.keydown(EVENT);
        expect($input.val()).toBe(BEFORE);
      });
    });

    describe('that are enter', function () {
      var EVENT = {keyCode: KEYCODES.enter};

      it('only submits input lines', function () {
        spyOn(instance, 'getNewerHistoryEntry');
        spyOn(instance, 'getOlderHistoryEntry');
        spyOn(instance, 'submit');
        instance.keydown(EVENT);
        expect(instance.getNewerHistoryEntry).not.toHaveBeenCalled();
        expect(instance.getOlderHistoryEntry).not.toHaveBeenCalled();
        expect(instance.submit).toHaveBeenCalled();
      });

      it('does not clear the input when returning a string', function () {
        spyOn(instance, 'submit').andReturn(AFTER);
        instance.keydown(EVENT);
        expect($input.val()).toBe(BEFORE);
      });

      it('does not clear the input when returning undefined', function () {
        spyOn(instance, 'submit').andReturn(undefined);
        instance.keydown(EVENT);
        expect($input.val()).toBe(BEFORE);
      });
    });
  });

  describe('with an empty command history', function () {
    it('gets newer history entries', function () {
      expect(instance.getNewerHistoryEntry()).toBeUndefined();
    });

    it('gets older history entries', function () {
      expect(instance.getOlderHistoryEntry()).toBeUndefined();
    });
  });

  describe('with a non-empty command history', function () {
    var expectedHistory = ['shaken', 'not', 'stirred'];

    beforeEach(function () {
      instance.history = expectedHistory;
    });

    afterEach(function () {
      instance.history = [];
      instance.historyIndex = instance.history.length;
    });

    it('gets newer history entries', function () {
      instance.historyIndex = 0;

      var actual;
      // We init to 1 because historyIndex must be incremented and setting
      // historyIndex to -1 is an invalid state.
      for (var i = 1; i < expectedHistory.length; i++) {
        actual = instance.getNewerHistoryEntry();
        expect(actual).toBe(expectedHistory[i]);
      }
      actual = instance.getNewerHistoryEntry();
      expect(actual).toBe('');
      for (i = 0; i < 2; i++) {
        actual = instance.getNewerHistoryEntry();
        expect(actual).toBeUndefined();
      }
    });

    it('gets older history entries', function () {
      instance.historyIndex = instance.history.length;

      var actual;
      for (var i = expectedHistory.length - 1; i >= 0; i--) {
        actual = instance.getOlderHistoryEntry();
        expect(actual).toBe(expectedHistory[i]);
      }
      for (i = 0; i < 2; i++) {
        actual = instance.getOlderHistoryEntry();
        expect(actual).toBe(expectedHistory[0]);
      }
    });
  });

  it('submits input lines', function () {
    expect(instance.history.length).toBe(0);
    for (var i = 1; i < 4; i++) {
      var line = i.toString();
      instance.submit(line);
      expect(instance.history.length).toBe(i);
      expect(instance.history).toContain(line);
      expect(instance.historyIndex).toBe(i);
    }
  });

  it('waits to move the cursor to the end', function () {
    var setTimeoutMock = spyOn(window, 'setTimeout');
    instance.moveCursorToEnd();
    expect(setTimeoutMock).toHaveBeenCalled();
    var args = setTimeoutMock.calls[0].args;
    expect(typeof(args[0])).toEqual('function');
    expect(args[1]).toEqual(0);
  });

  describe('moving the cursor to the end of the line', function () {
    var callDeferredFunc = function () {
      var setTimeoutMock = spyOn(window, 'setTimeout');
      instance.moveCursorToEnd();
      setTimeoutMock.calls[0].args[0]();
    };

    it('uses the setSelectionRange method when available', function () {
      var input = {
        setSelectionRange: jasmine.createSpy()
      };
      instance.$input = {
        val: jasmine.createSpy().andReturn('123'),
        get: jasmine.createSpy().andReturn(input)
      };
      callDeferredFunc();

      expect(input.setSelectionRange.calls.length).toEqual(1);
      expect(input.setSelectionRange).toHaveBeenCalledWith(6, 6);

      expect(instance.$input.val.calls.length).toEqual(1);
      expect(instance.$input.val).toHaveBeenCalledWith();
    });

    it('uses a fallback when setSelectionRange is not available', function () {
      instance.$input = {
        val: jasmine.createSpy().andReturn('123'),
        get: jasmine.createSpy().andReturn({})
      };
      callDeferredFunc();

      expect(instance.$input.val.calls.length).toEqual(2);
      expect(instance.$input.val.calls[0].args).toEqual([]);
      expect(instance.$input.val.calls[1].args).toEqual(['123']);
    });
  });

  describe('saving local command history', function(){
    it('loads on init', function(){
      expect(instance.history).toEqual([]);
      localStorage[mongo.const.shellHistoryKey] = '["1","2","3"]';
      instance = new mongo.Readline($input);
      expect(instance.history).toEqual(['1', '2', '3']);
    });

    it('saves on input', function(){
      expect(instance.history).toEqual([]);
      instance.submit('command');
      expect(localStorage[mongo.const.shellHistoryKey]).toEqual('["command"]');
    });

    it('limits history size', function(){
      var size = mongo.const.shellHistorySize = 5;
      for (var i = 0; i < size; i++){
        instance.submit(i.toString());
      }
      expect(localStorage[mongo.const.shellHistoryKey]).toEqual('["0","1","2","3","4"]');
      instance.submit('bump');
      expect(localStorage[mongo.const.shellHistoryKey]).toEqual('["1","2","3","4","bump"]');
    });

    it('fails gracefully when localStorage is not available', function(){
      localStorage = undefined;
      instance = new mongo.Readline($input);
      expect(instance.history).toEqual([]);
      instance.submit('command');
      expect(instance.history).toEqual(['command']);
    });
  });

  describe('getting the last command', function(){
    it('handles empty history', function(){
      instance.history = [];
      expect(instance.getLastCommand()).toBeUndefined();
    });

    it('ignores the command that is currently being executed', function () {
      instance.history = ['1'];
      expect(instance.getLastCommand()).toBeUndefined();
      instance.history = ['1', '2', '3'];
      expect(instance.getLastCommand()).toEqual('2');
    });
  });
});
