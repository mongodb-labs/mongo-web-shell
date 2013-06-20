/* global afterEach, beforeEach, CONST, describe, expect, it, jasmine, mongo */
/* global spyOn, xit */
/* jshint evil: true */
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

  it('creates a database object', function () {
    expect(instance.db instanceof mongo.DB).toBe(true);
    expect(instance.db.shell).toBe(instance);
    expect(instance.db.name).toBe('test');
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

  describe('has a print() function', function () {
    var printFunc;

    beforeEach(function () {
      instance.injectHTML();
      printFunc = spyOn(instance.$sandbox.contentWindow, 'print').andCallThrough();
      spyOn(instance, 'insertResponseLine');
      esprima = {parse: function () {}};
      spyOn(mongo.util, 'sourceToStatements').andCallFake(function (src) {
        return [src];
      });
    });

    it('that prints nonobjects', function () {
      instance.$input = {
        val: function () {return 'print("mongo")';}
      };
      instance.handleInput();
      expect(printFunc).toHaveBeenCalledWith('mongo');
      expect(instance.insertResponseLine).toHaveBeenCalledWith('mongo');
    });

    it('that prints stringified objects', function () {
      instance.$input = {
        val: function () {return 'print({name: "Mongo"})';}
      };
      instance.handleInput();
      expect(printFunc).toHaveBeenCalledWith({name: 'Mongo'});
      expect(instance.insertResponseLine).toHaveBeenCalledWith('{"name":"Mongo"}');
    });

    it('that it uses the toString for objects for which it is a function', function () {
      instance.$input = {
        val: function () {
          return 'function A(){};' +
            'A.prototype.toString = function(){ return "mongo!" };' +
            'var a = new A();' +
            'print(a);';
        }
      };
      instance.handleInput();
      expect(instance.insertResponseLine).toHaveBeenCalledWith('mongo!');
    });

    it('that refuses to print circular structures', function () {
      instance.$input = {
        val: function () {return 'var a = {}; a.a = a; print(a)';}
      };
      instance.handleInput();
      expect(instance.insertResponseLine.mostRecentCall.args[0]).toMatch(/^ERROR: /);
    });

  });

  describe('that has injected its HTML', function () {
    beforeEach(function () {
      instance.injectHTML();
      // This is cleaned up in the parent afterEach().
    });

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
      var SWAPPED_CALLS = 'calls', AST = 'ast',
        STATEMENTS = ['1', '2'];
      var $input, swapCallsThrowsError, parseThrowsError, evalThrowsError;

      beforeEach(function () {
        var ms = mongo.mutateSource;
        spyOn(instance, 'insertResponseLine');
        spyOn(mongo.keyword, 'handleKeywords').andReturn(false);
        spyOn(ms, 'swapMemberAccesses').andCallFake(function () {
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

      it('checks for keywords first', function () {
        var handleKeywords = mongo.keyword.handleKeywords;
        var swapMemberAccess = mongo.mutateSource.swapMemberAccesses;

        var keywordInput = 'use a keyword';
        handleKeywords.andReturn(true);
        $input.val(keywordInput);
        instance.handleInput();
        expect(handleKeywords).toHaveBeenCalledWith(instance, keywordInput);
        expect(swapMemberAccess).not.toHaveBeenCalled();

        handleKeywords.reset();
        swapMemberAccess.reset();
        var jsInput = 'not.a = keyword;';
        handleKeywords.andReturn(false);
        $input.val(jsInput);
        instance.handleInput();
        expect(handleKeywords).toHaveBeenCalledWith(instance, jsInput);
        expect(swapMemberAccess).toHaveBeenCalledWith(jsInput);

      });

      it('mutates and evalutaes the source', function () {
        var ms = mongo.mutateSource;
        var kw = mongo.keyword;
        var userInput = ';';
        $input.val(userInput);
        instance.handleInput();
        expect(kw.handleKeywords).toHaveBeenCalledWith(instance, userInput);
        expect(ms.swapMemberAccesses).toHaveBeenCalledWith(userInput);
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
    var evalSpy;
    beforeEach(function () {
      // Cleaned up in parent afterEach
      instance.injectHTML();
      spyOn(instance.$sandbox.contentWindow, 'eval').andCallThrough();
      evalSpy = instance.$sandbox.contentWindow.eval;

      spyOn(instance, 'insertResponseLine');
      spyOn(mongo.Cursor.prototype, '_printBatch');
      spyOn(mongo.Cursor.prototype, '_executeQuery').andCallFake(function (
          onSuccess) {
        onSuccess();
      });
      // TODO: eval() should be spied upon, however, I was unable to determine
      // how to do that without making either jshint or jasmine angry.
    });

    it('uses the sandbox to evalute the javascript', function () {
      var statements = ['var i = {};', 'i.a = 2'];
      instance.evalStatements(statements);
      expect(evalSpy.calls[0].args).toEqual([statements[0]]);
      expect(evalSpy.calls[1].args).toEqual([statements[1]]);
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
        expect(instance.insertResponseLine).toHaveBeenCalledWith(i.toString());
      }
    });

    it('executes an output Cursor query and prints a batch', function () {
      var shell = shells[0];
      shell.$sandbox.contentWindow.myCursor = new mongo.Cursor(shell, function () {});
      var statements = ['myCursor'];
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
