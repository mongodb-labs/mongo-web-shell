/* global afterEach, beforeEach, describe, expect, it, mongo, spyOn, jasmine, localStorage:true */
describe('A Readline instance', function () {
  var codemirror, submitFunc, instance;

  beforeEach(function () {
    mongo.const.shellHistoryKey = 'temporary_key';
    delete localStorage[mongo.const.shellHistoryKey];
    codemirror = {
      on: jasmine.createSpy('codemirror.on')
    };
    submitFunc = jasmine.createSpy('submit function');
    instance = new mongo.Readline(codemirror, submitFunc);
  });

  afterEach(function () {
    codemirror = null;
    instance = null;
    delete localStorage[mongo.const.shellHistoryKey];
  });

  it('registers a keydown handler', function () {
    codemirror.on.reset();
    spyOn(mongo.Readline.prototype, 'keydown');
    instance = new mongo.Readline(codemirror, submitFunc);

    expect(codemirror.on).toHaveBeenCalled();
    expect(codemirror.on.calls[0].args[0]).toEqual('keydown');
    codemirror.on.calls[0].args[1]();
    expect(instance.keydown).toHaveBeenCalled();
  });

  describe('listening for keystrokes', function () {
    var AFTER = 'after';
    var BEFORE = 'before';
    var KEYCODES = {up: 0, down: 1, enter: 2};
    var EVENT;
    var constStore;

    beforeEach(function () {
      constStore = mongo.const;
      mongo.const = {keycodes: KEYCODES};
      codemirror.getValue = function () {return BEFORE;};
      codemirror.setValue = jasmine.createSpy('setValue');
      EVENT = {
        preventDefault: jasmine.createSpy('preventDefault')
      };
    });

    afterEach(function () {
      mongo.const = constStore;
    });

    it('prevents the default action for known key codes', function () {
      EVENT.keyCode = 20; // unknown key code
      instance.keydown(EVENT);
      expect(EVENT.preventDefault).not.toHaveBeenCalled();

      EVENT.keyCode = KEYCODES.down;
      instance.keydown(EVENT);
      expect(EVENT.preventDefault).toHaveBeenCalled();
    });

    // When adding additional keys, be sure to update the other keys' 'only'
    // methods.
    describe('that are the down arrow', function () {
      beforeEach(function () {
        EVENT.keyCode = KEYCODES.down;
      });

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
        expect(codemirror.setValue).toHaveBeenCalledWith(AFTER);
        expect(moveCursorToEnd).toHaveBeenCalled();
      });

      it('does not clear the input when returning undefined', function () {
        spyOn(instance, 'getNewerHistoryEntry').andReturn(undefined);
        instance.keydown(EVENT);
        expect(codemirror.setValue).not.toHaveBeenCalled();
      });
    });

    describe('that are the up arrow', function () {
      beforeEach(function () {
        EVENT.keyCode = KEYCODES.up;
      });

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
        expect(codemirror.setValue).toHaveBeenCalledWith(AFTER);
        expect(moveCursorToEnd).toHaveBeenCalled();
      });

      it('does not clear the input when returning undefined', function () {
        spyOn(instance, 'getOlderHistoryEntry').andReturn(undefined);
        instance.keydown(EVENT);
        expect(codemirror.setValue).not.toHaveBeenCalled();
      });
    });

    describe('that are enter', function () {
      beforeEach(function () {
        EVENT.keyCode = KEYCODES.enter;
      });

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
        expect(codemirror.setValue).not.toHaveBeenCalled();
      });

      it('does not clear the input when returning undefined', function () {
        spyOn(instance, 'submit').andReturn(undefined);
        instance.keydown(EVENT);
        expect(codemirror.setValue).not.toHaveBeenCalled();
      });

      it('calls the supplied submit function', function () {
        instance.keydown(EVENT);
        expect(submitFunc).toHaveBeenCalledWith(); // no args
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

  it('moves the cursor the the end of the last line', function () {
    instance.inputBox.lineCount = jasmine.createSpy().andReturn(5);
    instance.inputBox.getLine = jasmine.createSpy().andReturn('1234567'); // length 7
    instance.inputBox.setCursor = jasmine.createSpy();

    instance.moveCursorToEnd();
    expect(instance.inputBox.lineCount).toHaveBeenCalledWith(); // no args
    expect(instance.inputBox.getLine).toHaveBeenCalledWith(4);
    expect(instance.inputBox.setCursor).toHaveBeenCalledWith({
      line: 4,
      pos: 6
    });
  });

  describe('saving local command history', function(){
    it('loads on init', function(){
      expect(instance.history).toEqual([]);
      localStorage[mongo.const.shellHistoryKey] = '["1","2","3"]';
      instance = new mongo.Readline(codemirror, submitFunc);
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
      instance = new mongo.Readline(codemirror, submitFunc);
      expect(instance.history).toEqual([]);
      instance.submit('command');
      expect(instance.history).toEqual(['command']);
    });
  });
});
