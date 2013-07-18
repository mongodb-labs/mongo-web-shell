/* global afterEach, beforeEach, CONST, describe, expect, it, jasmine, mongo */
/* global spyOn, xit, CodeMirror */
/* jshint evil: true, nonew: false */
describe('A Shell', function () {
  var instance, $rootElement;
  var SHELL_COUNT = 2;

  beforeEach(function () {
    $rootElement = $('<div class=' + CONST.css.classes.root + '/>');
    $('body').append($rootElement);
    instance = new mongo.Shell($rootElement.get(0), 0);
    mongo.shells = [instance];
  });

  afterEach(function () {
    $('.' + CONST.css.classes.root).remove();
    $('iframe').remove();
  });

  it('creates a database object', function () {
    expect(instance.db instanceof mongo.DB).toBe(true);
    expect(instance.db.shell).toBe(instance);
    expect(instance.db.name).toBe('test');
  });

  it('injects its HTML into the DOM', function () {
    spyOn(window, 'CodeMirror').andCallThrough();

    function expectInternalLength(len) {
      CONST.css.classes.internal.forEach(function (cssClass) {
        var $element = $('.' + cssClass);
        expect($element.length).toBe(len);
      });
    }

    // Remove all existing shells from the page
    $('.' + CONST.css.classes.root).remove();
    expectInternalLength(0);
    for (var i = 0; i < SHELL_COUNT; i++) {
      var $div = $('<div class=' + CONST.css.classes.root + '/>');
      $('body').append($div);
      var shell = new mongo.Shell($div, i);
      var inputLI = shell.$inputLI.get(0);
      expect(CodeMirror.mostRecentCall.args[0]).toBe(inputLI);
      var codeMirrorOptions = CodeMirror.mostRecentCall.args[1];
      expect(codeMirrorOptions.matchBrackets).toBe(true);
      expect(codeMirrorOptions.readOnly).toEqual('nocursor');
      expectInternalLength(i + 1);
    }
  });

  it('attaches the click listener', function () {
    var attachClickListener = spyOn(mongo.Shell.prototype, 'attachClickListener').andCallThrough();
    $rootElement.empty();

    var shell = new mongo.Shell($rootElement.get(0), 0);
    expect(attachClickListener).toHaveBeenCalled();

    spyOn(shell.inputBox, 'focus');
    spyOn(shell.inputBox, 'refresh');

    shell.$rootElement.trigger('click');
    expect(shell.inputBox.focus).toHaveBeenCalled();
    expect(shell.inputBox.refresh).toHaveBeenCalled();
  });

  describe('has a print() function', function () {
    var printFunc;

    beforeEach(function () {
      printFunc = spyOn(instance.$sandbox.contentWindow, 'print').andCallThrough();
      spyOn(instance, 'insertResponseLine');
    });

    it('that prints nonobjects', function () {
      instance.inputBox.getValue = function () {return 'print("mongo")';};
      instance.handleInput();
      expect(printFunc).toHaveBeenCalledWith('mongo');
      expect(instance.insertResponseLine).toHaveBeenCalledWith('mongo');
    });

    it('that prints stringified objects', function () {
      instance.inputBox.getValue = function () {
        return 'print({name: "Mongo"})';
      };
      instance.handleInput();
      expect(printFunc).toHaveBeenCalledWith({name: 'Mongo'});
      expect(instance.insertResponseLine).toHaveBeenCalledWith('{"name":"Mongo"}');
    });

    it('that it uses the toString for objects for which it is a function', function () {
      instance.inputBox.getValue = function () {
        return 'function A(){};' +
          'A.prototype.toString = function(){ return "mongo!" };' +
          'var a = new A();' +
          'print(a);';
      };
      instance.handleInput();
      expect(instance.insertResponseLine).toHaveBeenCalledWith('mongo!');
    });

    it('that refuses to print circular structures', function () {
      instance.inputBox.getValue = function () {return 'var a = {}; a.a = a; print(a)';};
      instance.handleInput();
      expect(instance.insertResponseLine.mostRecentCall.args[0]).toMatch(/^ERROR: /);
    });

    it('handles multiple arguments', function(){
      instance.inputBox.getValue = function () {
        return 'print(1, null, undefined, {}, {a:1}, "abc")';
      };
      instance.handleInput();
      expect(instance.insertResponseLine).toHaveBeenCalledWith('1 null undefined {} {"a":1} abc');
    });

  });

  describe('that has injected its HTML', function () {
    it('creates a hidden iframe sandbox', function () {
      var sandbox = instance.$sandbox;
      expect(sandbox instanceof HTMLIFrameElement).toBe(true);
      expect(sandbox.height).toEqual('0');
      expect(sandbox.width).toEqual('0');
      expect(sandbox.style.visibility).toEqual('hidden');
    });

    it('initializes the sanbox\'s environment', function () {
      var win = instance.$sandbox.contentWindow;
      expect(win.__get).toBe(mongo.util.__get);
      expect(win.db).toBe(instance.db);
    });

    xit('focuses the input when clicked', function () {
      // TODO: Is it possible to test this?
    });

    it('attaches an input event listener', function () {
      spyOn(instance, 'handleInput');
      spyOn(instance, 'enableInput');
      spyOn(mongo, 'Readline').andCallThrough();
      var resID = 'iu';
      instance.attachInputHandler(resID);
      expect(instance.mwsResourceID).toBe(resID);
      expect(instance.enableInput).toHaveBeenCalledWith(true);
      expect(mongo.Readline).toHaveBeenCalled();
      expect(mongo.Readline.calls[0].args[0]).toEqual(instance.inputBox);
      mongo.Readline.calls[0].args[1]();
      expect(instance.handleInput).toHaveBeenCalled();
      expect(instance.handleInput.calls[0].object).toBe(instance);
      expect(instance.readline).toEqual(jasmine.any(mongo.Readline));
    });

    it('sets the enabled state of the input', function () {
      var cm = instance.inputBox;
      cm.setOption('readOnly', true);
      instance.enableInput(true);
      expect(cm.getOption('readOnly')).toBe(false);
      instance.enableInput(false);
      expect(cm.getOption('readOnly')).toBe('nocursor');
    });

    it('inserts an array of lines into the shell', function () {
      var responseList = $rootElement.find('.' +
          CONST.css.classes.responseList).get(0);
      var array = [];
      do  {
        array.push('line');
        var numResponses = responseList.children.length;
        instance.insertResponseArray(array);
        expect(responseList.children.length).toBe(numResponses + array.length);
        expectContentEntirelyScrolled(responseList);
      } while (array.length < 5);
    });

    it('inserts a line into the shell', function () {
      var responseList = $rootElement.find('.' +
          CONST.css.classes.responseList).get(0);
      for (var i = 0; i < 4; i++) {
        var numResponses = responseList.children.length;
        instance.insertResponseLine('line');
        expect(responseList.children.length).toBe(numResponses + 1);
        expectContentEntirelyScrolled(responseList);
      }
    });

    /**
     * Expects that the content of the given element has been entirely
     * scrolled. Code snippet via:
     * https://developer.mozilla.org/en-US/docs/DOM/scrollHeight
     * #Determine_if_an_element_has_been_totally_scrolled
     */
    function expectContentEntirelyScrolled(element) {
      expect(element.scrollHeight - element.scrollTop).toBe(
          element.clientHeight);
    }

    describe('while handling user input', function () {
      var SWAPPED_CALLS = 'calls';
      var swapCallsThrowsError, evalThrowsError;

      beforeEach(function () {
        var ms = mongo.mutateSource;
        spyOn(instance, 'insertResponseLine');
        spyOn(mongo.keyword, 'handleKeywords').andReturn(false);
        spyOn(ms, 'swapMemberAccesses').andCallFake(function () {
          if (swapCallsThrowsError) { throw {}; }
          return SWAPPED_CALLS;
        });
        spyOn(instance, 'eval').andCallFake(function () {
          if (evalThrowsError) { throw {}; }
        });
        swapCallsThrowsError = evalThrowsError = false;
      });

      it('clears the input value and inserts it into responses', function () {
        var expected = ';';
        instance.inputBox.setValue(expected);
        instance.handleInput();
        expect(instance.inputBox.getValue()).toBe('');
        expect(instance.insertResponseLine).toHaveBeenCalledWith(expected, '> ');
      });

      it('checks for keywords first', function () {
        var handleKeywords = mongo.keyword.handleKeywords;
        var swapMemberAccess = mongo.mutateSource.swapMemberAccesses;

        var keywordInput = 'use a keyword';
        handleKeywords.andReturn(true);
        instance.inputBox.setValue(keywordInput);
        instance.handleInput();
        expect(handleKeywords).toHaveBeenCalledWith(instance, keywordInput);
        expect(swapMemberAccess).not.toHaveBeenCalled();

        handleKeywords.reset();
        swapMemberAccess.reset();
        var jsInput = 'not.a = keyword;';
        handleKeywords.andReturn(false);
        instance.inputBox.setValue(jsInput);
        instance.handleInput();
        expect(handleKeywords).toHaveBeenCalledWith(instance, jsInput);
        expect(swapMemberAccess).toHaveBeenCalledWith(jsInput);

      });

      it('mutates and evalutaes the source', function () {
        var ms = mongo.mutateSource;
        var kw = mongo.keyword;
        var userInput = ';';
        instance.inputBox.setValue(userInput);
        instance.handleInput();
        expect(kw.handleKeywords).toHaveBeenCalledWith(instance, userInput);
        expect(ms.swapMemberAccesses).toHaveBeenCalledWith(userInput);
        expect(instance.eval).toHaveBeenCalledWith(SWAPPED_CALLS);
      });

      it('prints errors to the terminal on invalid output', function () {
        var expectedIncrement = 2; // User input and error printed.
        var calls = instance.insertResponseLine.calls;

        var oldCount = calls.length;
        swapCallsThrowsError = true;
        instance.handleInput();
        expect(mongo.mutateSource.swapMemberAccesses).toHaveBeenCalled();
        expect(instance.eval).not.toHaveBeenCalled();
        expect(calls.length).toBe(oldCount + expectedIncrement);

        oldCount = calls.length;
        swapCallsThrowsError = false;
        evalThrowsError = true;
        instance.handleInput();
        expect(instance.eval).toHaveBeenCalled();
        expect(calls.length).toBe(oldCount + expectedIncrement);
      });
    });
  });

  describe('evaling JavaScript statements', function () {
    var evalSpy;
    beforeEach(function () {
      evalSpy = spyOn(instance.$sandbox.contentWindow, 'eval').andCallThrough();

      spyOn(instance, 'insertResponseLine');
      spyOn(mongo.Cursor.prototype, '_printBatch');
      spyOn(mongo.Cursor.prototype, '_executeQuery').andCallFake(
        function (onSuccess) { onSuccess(); }
      );
    });

    it('uses the sandbox to evalute the javascript', function () {
      var statements = 'var i = {}; i.a = 2';
      instance.eval(statements);
      expect(evalSpy).toHaveBeenCalledWith(statements);
    });

    it('does not print valid statement output that is undefined', function () {
      var statements = ['var i = 4;', 'function i() { };'];
      for (var i = 0; i < statements.length; i++) {
        instance.eval(statements[i]);
        expect(instance.insertResponseLine).not.toHaveBeenCalled();
      }
    });

    it('prints valid statement output that is not undefined', function () {
      var statements = ['0', 'i = 1;', '(function () { return 2; }());'];
      for (var i = 0; i < statements.length; i++) {
        instance.eval(statements[i]);
        expect(instance.insertResponseLine).toHaveBeenCalledWith(i);
      }
    });

    it('executes an output Cursor query and prints a batch', function () {
      instance.$sandbox.contentWindow.myCursor = new mongo.Cursor(instance, function () {});
      var statements = 'myCursor';
      instance.eval(statements);
      expect(mongo.Cursor.prototype._printBatch).toHaveBeenCalled();
    });

    it('throws an error if the statement is invalid', function () {
      expect(function () { instance.eval('invalid'); }).toThrow();
    });
  });

  describe('inserting a line', function () {
    var expected, toString, refresh;
    beforeEach(function () {
      expected = 'myString';
      toString = spyOn(mongo.util, 'toString').andReturn(expected);
      refresh = jasmine.createSpy('refresh');
      spyOn(window, 'CodeMirror').andReturn({refresh: refresh});
      instance.$inputLI = {
        before: jasmine.createSpy('$inputLI')
      };
      instance.$responseList = {
        0: {scrollHeight: 0},
        scrollTop: jasmine.createSpy()
      };
    });

    it('stringifies and highlights objects', function () {
      instance.insertResponseLine(123);
      expect(toString).toHaveBeenCalledWith(123);
      expect(instance.$inputLI.before).toHaveBeenCalled();
      var li = instance.$inputLI.before.calls[0].args[0];
      expect(CodeMirror).toHaveBeenCalledWith(li, {readOnly: true, value: expected});
      expect(refresh).toHaveBeenCalled();
    });

    it('highlights string commands', function () {
      instance.insertResponseLine('an input string', '> ');
      expect(toString).toHaveBeenCalledWith('an input string');
      expect(instance.$inputLI.before).toHaveBeenCalled();
      var li = instance.$inputLI.before.calls[0].args[0];
      expect(CodeMirror).toHaveBeenCalledWith(li, {readOnly: true, value: expected});
      expect(refresh).toHaveBeenCalled();
    });

    it('does not highlights response strings', function () {
      instance.insertResponseLine('an input string');
      expect(toString).toHaveBeenCalledWith('an input string');
      expect(instance.$inputLI.before).toHaveBeenCalled();
      var li = instance.$inputLI.before.calls[0].args[0];
      expect(li.innerHTML).toEqual(expected);
      expect(li.className).toEqual('mws-plain-result');
      expect(CodeMirror).not.toHaveBeenCalled();
    });

    it('prepends the given string', function () {
      instance.insertResponseLine({my: 'obj'}, '==> ');
      expect(instance.$inputLI.before).toHaveBeenCalled();
      var li = instance.$inputLI.before.calls[0].args[0];
      expect(li.innerHTML.indexOf('==&gt; ')).toBe(0);
    });
  });

  it('gets the shellBatchSize', function () {
    var expected = [0, 20, 40];
    expected.forEach(function (val) {
      instance.vars.DBQuery.shellBatchSize = val;
      expect(instance.getShellBatchSize()).toBe(val);
    });

    expected = [null, undefined, NaN, '', [], {}, 'iu'];
    expected.forEach(function (val) {
      // TODO: Check insertResponseLine.
      instance.vars.DBQuery.shellBatchSize = val;
      var willThrow = function () { instance.getShellBatchSize(); };
      expect(willThrow).toThrow();
    });
  });

  it('extracts messages from errors', function () {
    instance.$sandbox = {
      contentWindow: {Error: function () {}}
    };
    var irl = spyOn(instance, 'insertResponseLine');

    instance.insertError(new ReferenceError('My Message'));
    expect(irl).toHaveBeenCalledWith('ReferenceError: My Message');

    instance.insertError({message: 'Second Message'});
    expect(irl).toHaveBeenCalledWith('ERROR: Second Message');

    instance.insertError('Third Message');
    expect(irl).toHaveBeenCalledWith('ERROR: Third Message');
  });
});
