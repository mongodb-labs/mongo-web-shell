/* global afterEach, beforeEach, CONST, describe, expect, it, jasmine, mongo */
/* global spyOn, xit */
var esprima; // Stubbed later.
describe('A Shell', function () {
  var shells, instance, $rootElement;
  var rootElements;
  var SHELL_COUNT = 2;

  beforeEach(function () {
    mongo.shells = shells = [];
    rootElements = [];
    for (var i = 0; i < SHELL_COUNT; i++) {
      var div = document.createElement('div');
      div.className = CONST.css.classes.root;
      document.body.appendChild(div);
      shells.push(new mongo.Shell(div, i));
      rootElements.push(div);
    }
    instance = shells[0];
    $rootElement = $(rootElements[0]);
  });

  afterEach(function () {
    instance = null;
    $rootElement = null;
    while (rootElements.length > 0) {
      var element = rootElements.pop();
      element.parentNode.removeChild(element);
    }
    shells = null;
    rootElements = null;
  });

  it('injects its HTML into the DOM', function () {
    function expectInternalLength(len) {
      CONST.css.classes.internal.forEach(function (cssClass) {
        var $element = $('.' + cssClass);
        expect($element.length).toBe(len);
      });
    }

    expectInternalLength(0);
    shells.forEach(function (shell, i) {
      shell.injectHTML();
      expectInternalLength(i + 1);
    });
  });

  it('submits a keep alive request', function () {
    spyOn(mongo.request, 'keepAlive');
    instance.keepAlive();
    expect(mongo.request.keepAlive).toHaveBeenCalledWith(instance);
  });

  describe('has a print() function', function(){
    beforeEach(function(){
      spyOn(instance.vars, 'print').andCallThrough();
      spyOn(instance, 'insertResponseLine');
      esprima = {parse: function(){}};
      spyOn(mongo.util, 'sourceToStatements').andCallFake(function(src){return [src];});
    });

    it('that prints nonobjects', function(){
      instance.$input = {val: function(){ return 'print("mongo")';} };
      instance.handleInput();
      expect(instance.vars.print).toHaveBeenCalledWith('mongo');
      expect(instance.insertResponseLine).toHaveBeenCalledWith('mongo');
    });

    it('that prints stringified objects', function(){
      instance.$input = {val: function(){ return 'print({name: "Mongo"})';} };
      instance.handleInput();
      expect(instance.vars.print).toHaveBeenCalledWith({name:'Mongo'});
      expect(instance.insertResponseLine).toHaveBeenCalledWith('{"name":"Mongo"}');
    });

    it('that refuses to print circular structures', function(){
      instance.$input = {val: function(){ return 'var a = {}; a.a = a; print(a)';} };
      instance.handleInput();
      expect(instance.insertResponseLine.mostRecentCall.args[0]).toMatch(/^ERROR: /);
    });

  });

  describe('that has injected its HTML', function () {
    beforeEach(function () {
      instance.injectHTML();
      // This is cleaned up in the parent afterEach().
    });

    it('attaches a click listener', function () {
      spyOn(instance, 'onClick');
      instance.attachClickListener();
      instance.$rootElement.trigger('click');
      expect(instance.onClick).toHaveBeenCalled();
    });

    xit('focuses the input when clicked', function () {
      // TODO: Is it possible to test this?
    });

    it('attaches an input event listener', function () {
      spyOn(instance, 'handleInput');
      spyOn(mongo, 'Readline').andCallThrough();
      var resID = 'iu';
      instance.attachInputHandler(resID);
      expect(instance.mwsResourceID).toBe(resID);
      $rootElement.find('form').submit();
      expect(instance.handleInput).toHaveBeenCalled();
      expect(mongo.Readline).toHaveBeenCalledWith(instance.$input);
      expect(instance.readline).toEqual(jasmine.any(mongo.Readline));
    });

    it('sets the enabled state of the input', function () {
      var $input = $rootElement.find('input');
      $input.get(0).disabled = true;
      instance.enableInput(true);
      expect($input.get(0).disabled).toBe(false);
      instance.enableInput(false);
      expect($input.get(0).disabled).toBe(true);
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
      var SWAPPED_CALLS = 'calls', SWAPPED_KEYWORDS = 'keywords', AST = 'ast',
          STATEMENTS = ['1', '2'];
      var $input, swapCallsThrowsError, parseThrowsError, evalThrowsError;

      beforeEach(function () {
        var ms = mongo.mutateSource;
        spyOn(instance, 'insertResponseLine');
        spyOn(ms, 'swapKeywords').andReturn(SWAPPED_KEYWORDS);
        spyOn(ms, 'swapMongoCalls').andCallFake(function () {
          if (swapCallsThrowsError) { throw {}; }
          return SWAPPED_CALLS;
        });
        esprima = jasmine.createSpyObj('esprima', ['parse']);
        esprima.parse.andCallFake(function () {
          if (parseThrowsError) { throw {}; }
          return AST;
        });
        spyOn(mongo.util, 'sourceToStatements').andReturn(STATEMENTS);
        spyOn(instance, 'evalStatements').andCallFake(function () {
          if (evalThrowsError) { throw {}; }
        });
        $input = $rootElement.find('input');
        swapCallsThrowsError = parseThrowsError = evalThrowsError = false;
      });

      afterEach(function () {
        esprima = null;
        $input = null;
      });

      it('clears the input value and inserts it into responses', function () {
        var expected = ';';
        $input.val(expected);
        instance.handleInput();
        expect($input.val()).toBe('');
        expect(instance.insertResponseLine).toHaveBeenCalledWith('> ' + expected);
      });

      it('mutates and evalutaes the source', function () {
        var ms = mongo.mutateSource;
        var id = instance.id;
        var userInput = ';';
        $input.val(userInput);
        instance.handleInput();
        expect(ms.swapKeywords).toHaveBeenCalledWith(userInput, id);
        expect(ms.swapMongoCalls).toHaveBeenCalledWith(SWAPPED_KEYWORDS, id);
        expect(esprima.parse).toHaveBeenCalledWith(SWAPPED_CALLS,
            {range: true});
        expect(mongo.util.sourceToStatements).toHaveBeenCalledWith(
            SWAPPED_CALLS, AST);
        expect(instance.evalStatements).toHaveBeenCalledWith(STATEMENTS);
      });

      it('prints errors to the terminal on invalid output', function () {
        var expectedIncrement = 2; // User input and error printed.
        var calls = instance.insertResponseLine.calls;

        var oldCount = calls.length;
        swapCallsThrowsError = true;
        instance.handleInput();
        expect(calls.length).toBe(oldCount + expectedIncrement);

        oldCount = calls.length;
        swapCallsThrowsError = false;
        parseThrowsError = true;
        instance.handleInput();
        expect(calls.length).toBe(oldCount + expectedIncrement);

        oldCount = calls.length;
        parseThrowsError = false;
        evalThrowsError = true;
        instance.handleInput();
        expect(calls.length).toBe(oldCount + expectedIncrement);
      });
    });
  });

  describe('evaling JavaScript statements', function () {
    beforeEach(function () {
      spyOn(instance, 'insertResponseLine');
      spyOn(mongo.Cursor.prototype, '_printBatch');
      spyOn(mongo.Cursor.prototype, '_executeQuery').andCallFake(function (
          onSuccess) {
        onSuccess();
      });
      // TODO: eval() should be spied upon, however, I was unable to determine
      // how to do that without making either jshint or jasmine angry.
    });

    it('does not print valid statement output that is undefined', function () {
      var statements = ['var i = 4;', 'function i() { };'];
      instance.evalStatements(statements);
      expect(instance.insertResponseLine).not.toHaveBeenCalled();
    });

    it('prints valid statement output that is not undefined', function () {
      var statements = ['0', 'i = 1;', '(function () { return 2; }());'];
      instance.evalStatements(statements);
      for (var i = 0; i < statements.length; i++) {
        expect(instance.insertResponseLine).toHaveBeenCalledWith(i);
      }
    });

    it('executes an output Cursor query and prints a batch', function () {
      var statements = ['new mongo.Cursor(new mongo.Query(\'shell\', ' +
          '\'collectionName\'));'];
      instance.evalStatements(statements);
      expect(mongo.Cursor.prototype._executeQuery).toHaveBeenCalled();
      expect(mongo.Cursor.prototype._printBatch).toHaveBeenCalled();
    });

    it('throws an error if the statement invalid', function () {
      expect(function () { instance.evalStatements(['invalid']); }).toThrow();
    });
  });

  it('gets the shellBatchSize', function () {
    var shell = shells[0];
    var expected = [0, 20, 40];
    expected.forEach(function (val) {
      shell.vars.DBQuery.shellBatchSize = val;
      expect(shell.getShellBatchSize()).toBe(val);
    });

    expected = [null, undefined, NaN, '', [], {}, 'iu'];
    expected.forEach(function (val) {
      // TODO: Check insertResponseLine.
      shell.vars.DBQuery.shellBatchSize = val;
      var willThrow = function () { shell.getShellBatchSize(); };
      expect(willThrow).toThrow();
    });
  });
});
