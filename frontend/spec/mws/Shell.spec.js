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

/* global afterEach, beforeEach, CONST, describe, expect, it, jasmine, mongo */
/* global spyOn, xit, Evaluator */
/* jshint evil: true, nonew: false */
describe('A Shell', function () {
  var instance, $rootElement;

  beforeEach(function () {
    $rootElement = $('<div class=' + CONST.rootClass + '/>');
    $('body').append($rootElement);
    instance = new mongo.Shell($rootElement.get(0), 0);
    mongo.shells = [instance];
  });

  afterEach(function () {
    $('.' + CONST.rootClass).remove();
    $('iframe').remove();
  });

  it('creates a database object', function () {
    expect(instance.db instanceof mongo.DB).toBe(true);
    expect(instance.db.shell).toBe(instance);
    expect(instance.db.name).toBe('test');
  });

  it('injects its HTML into the DOM', function () {
    var inputChildren = instance.$rootElement.find('.mws-input').children();
    expect(inputChildren.length).toEqual(1);
    expect(inputChildren[0]).toEqual(instance.inputBox.getWrapperElement());

    var responseChildren = instance.$responseWrapper.children();
    expect(responseChildren.length).toEqual(1);
    expect(responseChildren[0]).toEqual(instance.responseBlock.getWrapperElement());
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
      var originalPrint = instance.evaluator.getGlobal('print');
      printFunc = jasmine.createSpy().andCallFake(originalPrint);
      instance.evaluator.setGlobal('print', printFunc);
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
      expect(instance.insertResponseLine).toHaveBeenCalledWith('{ "name" : "Mongo" }');
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
      var expected = '1 null undefined { } { "a" : 1 } abc';
      expect(instance.insertResponseLine).toHaveBeenCalledWith(expected);
    });

  });

  describe('that has injected its HTML', function () {
    it('creates an evaluator', function () {
      var evaluator = instance.evaluator;
      expect(evaluator).toEqual(jasmine.any(Evaluator));
    });

    it('initializes the evaluator\'s environment', function () {
      var e = instance.evaluator;
      expect(e.getGlobal('__get')).toBe(mongo.util.__get);
      expect(e.getGlobal('db')).toBe(instance.db);
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
      instance.insertResponseLine('line');
      var array = [];
      do  {
        array.push('line');
        var numResponses = instance.responseBlock.lineCount();
        instance.insertResponseArray(array);
        expect(instance.responseBlock.lineCount()).toBe(numResponses + array.length);
        expectContentEntirelyScrolled(instance.$scrollWrapper);
      } while (array.length < 5);
    });

    it('inserts a line into the shell', function () {
      // The first insert shouldn't add a new line, because we go from being on
      // an empty first line to populating the first line. Therefore the line
      // count should stay the same (as long as the inserted data doesn't have
      // a newline in it).
      expect(instance.responseBlock.lineCount()).toEqual(1);
      instance.insertResponseLine('line');
      expect(instance.responseBlock.lineCount()).toEqual(1);

      for (var i = 0; i < 4; i++) {
        var numResponses = instance.responseBlock.lineCount();
        instance.insertResponseLine('line');
        expect(instance.responseBlock.lineCount()).toBe(numResponses + 1);
        expectContentEntirelyScrolled(instance.$scrollWrapper);
      }
    });

    /**
     * Expects that the content of the given element has been entirely
     * scrolled. Code snippet via:
     * https://developer.mozilla.org/en-US/docs/DOM/scrollHeight
     * #Determine_if_an_element_has_been_totally_scrolled
     */
    function expectContentEntirelyScrolled($element) {
      var element = $element.get(0);
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
      evalSpy = spyOn(instance.evaluator, 'eval').andCallThrough();

      spyOn(instance, 'insertResponseLine');
      spyOn(mongo.Cursor.prototype, '_printBatch');
      spyOn(mongo.Cursor.prototype, '_executeQuery').andCallFake(
        function (onSuccess) { onSuccess(); }
      );
    });

    it('uses the evaluator to evaluate the javascript', function () {
      var statements = 'var i = {}; i.a = 2';
      instance.eval(statements);
      expect(evalSpy).toHaveBeenCalledWith(statements, jasmine.any(Function));
    });

    it('does not print valid statement output that is undefined', function () {
      var statements = ['var i = 4;', 'function i() { };'];
      for (var i = 0; i < statements.length; i++) {
        instance.eval(statements[i]);
        expect(instance.insertResponseLine).not.toHaveBeenCalled();
        instance.insertResponseLine.reset();
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
      instance.evaluator.setGlobal('myCursor', new mongo.Cursor(instance, function () {}));
      var statements = 'myCursor';
      instance.eval(statements);
      expect(mongo.Cursor.prototype._printBatch).toHaveBeenCalled();
    });

    it('inserts an error if the statement is invalid', function () {
      var insertError = spyOn(instance, 'insertError');
      instance.eval('invalid');
      expect(insertError).toHaveBeenCalled();
    });
  });

  describe('inserting a line', function () {
    var expected, toString, refresh, replaceRange;
    beforeEach(function () {
      expected = 'myString';
      toString = spyOn(mongo.util, 'toString').andReturn(expected);
      replaceRange = spyOn(instance.responseBlock, 'replaceRange');
      refresh = spyOn(instance.responseBlock, 'refresh');
    });

    it('stringifies and highlights objects', function () {
      // Does not insert newline before first line
      instance.insertResponseLine(123);
      expect(toString).toHaveBeenCalledWith(123);
      expect(replaceRange).toHaveBeenCalled();
      expect(replaceRange.mostRecentCall.args[0]).toEqual(expected);
      expect(refresh).toHaveBeenCalled();
      refresh.reset();

      // Inserts newlines before all subsequent lines
      instance.insertResponseLine(123);
      expect(refresh).toHaveBeenCalled();
      expect(replaceRange.mostRecentCall.args[0]).toEqual('\n' + expected);
    });

    it('highlights string commands', function () {
      instance.insertResponseLine('an input string', '> ');
      var lastLine = instance.responseBlock.lineCount() - 1;
      expect(instance.responseBlock.lineInfo(lastLine).textClass).toBeUndefined();
    });

    it('does not highlights response strings', function () {
      instance.insertResponseLine('an input string');
      var lastLine = instance.responseBlock.lineCount() - 1;
      expect(instance.responseBlock.lineInfo(lastLine).textClass).toEqual('mws-cm-plain-text');
    });

    it('prepends the given string', function () {
      instance.insertResponseLine({my: 'obj'}, '==> ');
      expect(replaceRange).toHaveBeenCalled();
      expect(replaceRange.mostRecentCall.args[0].indexOf('==> ')).toBe(0);
    });
  });

  it('gets the shellBatchSize', function () {
    var expected = [0, 20, 40];
    expected.forEach(function (val) {
      instance.shellBatchSize = val;
      expect(instance.getShellBatchSize()).toBe(val);
    });

    expected = [null, undefined, NaN, '', [], {}, 'iu'];
    expected.forEach(function (val) {
      // TODO: Check insertResponseLine.
      instance.shellBatchSize = val;
      var willThrow = function () { instance.getShellBatchSize(); };
      expect(willThrow).toThrow();
    });
  });

  it('extracts messages from errors', function () {
    var irl = spyOn(instance, 'insertResponseLine');

    instance.insertError(new ReferenceError('My Message'));
    expect(irl).toHaveBeenCalledWith('ReferenceError: My Message');

    instance.insertError({message: 'Second Message'});
    expect(irl).toHaveBeenCalledWith('ERROR: Second Message');

    instance.insertError('Third Message');
    expect(irl).toHaveBeenCalledWith('ERROR: Third Message');
  });
});
