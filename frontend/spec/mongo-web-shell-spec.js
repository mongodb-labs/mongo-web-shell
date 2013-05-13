/* jshint loopfunc: true */
/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, sinon */
/* global spyOn, xdescribe, xit */
$.ready = function () {}; // Prevent mongo.init() from running.
var console; // Avoid errors from util.enableConsoleProtection if console DNE.

var esprima; // stubbed where applicable.

var CONST = {
  css: {
    file: 'mongo-web-shell.css',
    classes: {
      root: '.mongo-web-shell',
      internal: [
        '.mws-wrapper',
        '.mws-topbar',
        '.mws-hide-button',
        '.mws-body',
        '.mws-scrollbar-spacer',
        '.mws-response-list',
        '.input-li',
        '.mws-form',
        '.mws-input'
      ],
      responseList: '.mws-response-list'
    }
  }
};


xdescribe('The init function', function () {
  // TODO: The calls made in mongo.init() need to be stubbed; there should be
  // no side effects to the page (alternatively, have side effects but restore
  // the page to the initial state on afterEach()). Then re-enable this.
  var xhr, requests;

  beforeEach(function () {
    xhr = sinon.useFakeXMLHttpRequest();
    requests = [];
    xhr.onCreate = function (req) { requests.push(req); };
  });

  afterEach(function () {
    xhr.restore();
  });

  xit('makes a post request for todo items', function () {
    mongo.init(sinon.spy());
    expect(requests.length).toBe(1);
    expect(requests[0].url).toBe('/mws/');
  });
});


describe('The const module', function () {
  it('stores keycode constants', function () {
    var key = mongo.const.keycodes;
    expect(key.enter).toBe(13);
    expect(key.left).toBe(37);
    expect(key.up).toBe(38);
    expect(key.right).toBe(39);
    expect(key.down).toBe(40);
  });

  it('stores the keep alive timeout', function () {
    expect(mongo.const.keepAliveTime).toBeDefined();
  });
});


describe('A Cursor', function () {
  var instance, batchSize = 2, getShellBatchSizeSpy, insertResponseLineSpy,
      queryFuncSpy, queryArgs;

  beforeEach(function () {
    insertResponseLineSpy = jasmine.createSpy('insertResponseLine');
    getShellBatchSizeSpy = jasmine.createSpy('getShellBatchSize').andCallFake(
        function () {
      return batchSize;
    });
    var mwsQuery = {
      shell: {
        getShellBatchSize: getShellBatchSizeSpy,
        insertResponseLine: insertResponseLineSpy,
        lastUsedCursor: null
      },
      collection: null
    };
    queryFuncSpy = jasmine.createSpy('queryFuncSpy');
    queryArgs = 'some args';
    instance = new mongo.Cursor(mwsQuery, queryFuncSpy, queryArgs);
  });

  afterEach(function () {
    queryFuncSpy = null;
    queryArgs = null;
    instance = null;
  });

  it('stores a query result', function () {
    var str = 'str';
    expect(instance._query.result).toBeNull();
    instance._storeQueryResult([str, 'does', 'not', 'matter']);
    expect(instance._query.result).toContain(str);
  });

  describe('depending on query state', function () {
    var stateStore, callbackSpy;

    beforeEach(function () {
      stateStore = instance._query.wasExecuted;
      callbackSpy = jasmine.createSpy('callback');
    });

    afterEach(function () {
      instance._query.wasExecuted = stateStore;
      stateStore = null;
      callbackSpy = null;
    });

    describe('before execution', function () {
      // Cursor._query.func, who calls the success callback, is a spy and so
      // the callback cannot be properly tested here.
      beforeEach(function () {
        instance._query.wasExecuted = false;
      });

      it('executes asynchronous queries', function () {
        var async = true;
        instance._executeQuery(callbackSpy, async);
        expect(instance._query.wasExecuted).toBe(true);
        expect(queryFuncSpy).toHaveBeenCalledWith(instance, callbackSpy,
            async);
      });

      it('executes synchronous queries', function () {
        var async = false;
        instance._executeQuery(callbackSpy, async);
        expect(instance._query.wasExecuted).toBe(true);
        expect(queryFuncSpy).toHaveBeenCalledWith(instance, callbackSpy,
            async);
      });

      it('executes default asynchronous queries', function () {
        instance._executeQuery(callbackSpy);
        expect(instance._query.wasExecuted).toBe(true);
        expect(queryFuncSpy).toHaveBeenCalledWith(instance, callbackSpy, true);
      });

      it('does not warn the user and returns false', function () {
        var actual = instance._warnIfExecuted('methodName');
        expect(actual).toBe(false);
        expect(insertResponseLineSpy).not.toHaveBeenCalled();
      });

      describe('will execute a query when it', function () {
        beforeEach(function () {
          spyOn(instance, '_executeQuery');
        });

        it('prints the next batch of results', function () {
          instance._printBatch();
          expect(instance._executeQuery).toHaveBeenCalled();
        });

        it('returns a boolean showing if it has another result', function () {
          instance.hasNext();
          expect(instance._executeQuery).toHaveBeenCalled();
        });

        it('returns the next result', function () {
          instance.next();
          expect(instance._executeQuery).toHaveBeenCalled();
        });
      });

      describe('will execute a function that', function () {
        it('sorts the query result set', function () {
          // TODO: Implement sort.
          var actual = instance.sort();
          expect(actual).toEqual(jasmine.any(mongo.Cursor));
        });
      });
    });

    describe('after execution', function () {
      beforeEach(function () {
        instance._query.wasExecuted = true;
      });

      it('does not re-execute and calls the on success callback', function () {
        instance._executeQuery(callbackSpy);
        expect(instance._query.wasExecuted).toBe(true);
        expect(queryFuncSpy).not.toHaveBeenCalled();
        expect(callbackSpy).toHaveBeenCalled();
      });

      it('warns the user and returns true', function () {
        var actual = instance._warnIfExecuted('methodName');
        expect(actual).toBe(true);
        expect(insertResponseLineSpy).toHaveBeenCalled();
      });

      describe('calls a success callback that', function () {
        var RESULTS = '123456'.split('');
        var shellBatchSizeStore, queryStore;

        beforeEach(function () {
          queryStore = instance._query.result;
          shellBatchSizeStore = batchSize;
          instance._query.result = RESULTS.slice(0); // A copy.
          instance._query.wasExecuted = true;
          spyOn(instance, '_executeQuery').andCallFake(function (onSuccess) {
            onSuccess();
          });
        });

        afterEach(function () {
          instance._query.result = queryStore;
          batchSize = shellBatchSizeStore;
          queryStore = null;
          shellBatchSizeStore = null;
        });

        it('prints the next batch of results', function () {
          // TODO: Check insertResponseArray when added?
          instance._shell.lastUsedCursor = null;
          for (var i = 1; i < 3; i++) {
            batchSize = i + 1;
            var oldResultLen = instance._query.result.length;
            instance._printBatch();
            expect(instance._shell.lastUsedCursor).toEqual(instance);
            expect(getShellBatchSizeSpy.calls.length).toBe(i);
            expect(instance._query.result.length).toBe(
                oldResultLen - batchSize);
            expect(insertResponseLineSpy).toHaveBeenCalled();
          }
          batchSize = instance._query.result.length + 1;
          instance._printBatch();
          expect(instance._query.result.length).toBe(0);
          var oldInsertCalls = insertResponseLineSpy.calls.length;
          instance._printBatch();
          expect(instance._query.result.length).toBe(0);
          expect(insertResponseLineSpy.calls.length).toBe(oldInsertCalls);
        });

        it('returns a boolean showing if it has another result', function () {
          var actual = instance.hasNext();
          expect(instance._executeQuery.calls.length).toBe(1);
          expect(actual).toBe(true);
          instance._query.result = [];
          actual = instance.hasNext();
          expect(instance._executeQuery.calls.length).toBe(2);
          expect(actual).toBe(false);
        });

        it('returns the next result', function () {
          var actual = [];
          for (var i = 0; i < RESULTS.length; i++) {
            actual.push(instance.next());
          }
          RESULTS.forEach(function (val) { expect(actual).toContain(val); });
          var oldCallCount = insertResponseLineSpy.calls.length;
          expect(instance.next()).toBeUndefined();
          // Error message.
          expect(insertResponseLineSpy.calls.length).toBe(oldCallCount + 1);
        });
      });

      describe('will not execute a function that', function () {
        it('sorts the query result set', function () {
          // TODO: Implement sort.
          var actual = instance.sort();
          expect(actual).toEqual(jasmine.any(mongo.Cursor));
        });
      });
    });
  });
});


describe('The dom module', function () {
  it('retrives the shell configuration from the DOM', function () {
    // TODO: Test more than the default values.
    var config = mongo.dom.retrieveConfig();
    // Default values.
    expect(config.cssPath).toBe(CONST.css.file);
    expect(config.mwsHost).toBe('');
    expect(config.baseUrl).toBe('/mws/');
  });

  it('injects a stylesheet into the DOM', function () {
    function expectAbsentCSS(cssFile) {
      $('link').each(function (index, linkElement) {
        expect(linkElement.href).not.toBe(cssFile);
      });
    }

    // TODO: Should the dom methods be stubbed instead?
    expectAbsentCSS(CONST.css.file);
    mongo.dom.injectStylesheet(CONST.css.file);
    var injected = $('head').children().get(0); // Expect to be prepended.
    expect(injected.tagName).toBe('LINK');
    expect(injected.href).toMatch(CONST.css.file + '$');
    expect(injected.rel).toBe('stylesheet');
    expect(injected.type).toBe('text/css');

    // Clean up.
    injected.parentNode.removeChild(injected);
    expectAbsentCSS(CONST.css.file);
  });
});


describe('The keyword module', function () {
  // TODO: Test.
});


describe('The mutateSource module', function () {
  // TODO: Test.
});


describe('A Query', function () {
  var instance, shellSpy, collectionName, requestStore;

  beforeEach(function () {
    requestStore = mongo.request;
    mongo.request = jasmine.createSpyObj('request', ['db_collection_find',
        'db_collection_insert']);
    spyOn(mongo, 'Cursor').andCallThrough();

    shellSpy = jasmine.createSpy('shell');
    collectionName = 'collectionName';
    instance = new mongo.Query(shellSpy, collectionName);
  });

  afterEach(function () {
    mongo.request = requestStore;
    requestStore = null;
  });

  // TODO: #105: Remove this when function name is refactored.
  /* jshint camelcase: false */
  it('can return a Cursor for finding within a collection', function () {
    var query = '{iu: "jjang"}', projection = '{_id: 0}';
    var args = {query: query, projection: projection};
    var actual = instance.find(query, projection);
    expect(mongo.Cursor).toHaveBeenCalledWith(instance,
        mongo.request.db_collection_find, args);
    expect(actual).toEqual(jasmine.any(mongo.Cursor));
    expect(mongo.request.db_collection_find).not.toHaveBeenCalled();
  });

  it('can make a request to insert into a collection', function () {
    var document_ = '{iu: "jjang"}';
    instance.insert(document_);
    expect(mongo.request.db_collection_insert).toHaveBeenCalledWith(instance,
        document_);
  });
});


describe('A Readline instance', function () {
  var $input, instance;

  beforeEach(function () {
    $input = $(document.createElement('input'));
    instance = new mongo.Readline($input);
  });

  afterEach(function () {
    $input = null;
    instance = null;
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
        spyOn(instance, 'getNewerHistoryEntry').andReturn(AFTER);
        instance.keydown(EVENT);
        expect($input.val()).toBe(AFTER);
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
        spyOn(instance, 'getOlderHistoryEntry').andReturn(AFTER);
        instance.keydown(EVENT);
        expect($input.val()).toBe(AFTER);
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
});


describe('The request module', function () {
  // TODO: Test untested methods.
  describe('relying on mongo.config', function () {
    var configStore;

    beforeEach(function () {
      configStore = mongo.config;
      mongo.config = {};
    });

    afterEach(function () {
      mongo.config = configStore;
    });

    it('creates a resource URL from the given parameters', function () {
      var gru = mongo.request._getResURL;
      mongo.config = {baseUrl: '/kpop/'};
      expect(gru('iu', 'jjang')).toBe('/kpop/iu/db/jjang/');
      mongo.config = {baseUrl: 'mws/'};
      expect(gru(30, 2)).toBe('mws/30/db/2/');
      expect(gru(null)).toBe('mws/null/db/undefined/');
      mongo.config = {baseUrl: 123};
      expect(gru('a', 'b')).toBe('123a/db/b/');
    });
  });

  it('prunes the given keys from the given object if undefined or null',
      function () {
    function Parent() {
      this.a = 'a';
      this.b = null;
    }
    function Child(y, z) {
      this.y = y;
      this.z = z;
    }
    Child.prototype = Parent;

    var keysToDelete = ['b', 'z'];
    var actual = [
      {b: 'b', z: 'z'}, // 0
      {a: 'a', b: undefined, y: undefined, z: null}, // 1
      {a: 'a'}, // 2
      {}, // 3
      new Parent(), // 4
      new Child('y', 'z'), // 5
      new Child('y') // 6
    ];
    var expected = [
      {b: 'b', z: 'z'}, // 0
      {a: 'a', y: undefined}, // 1
      {a: 'a'}, // 2
      {} // 3
    ];
    var tmp = new Parent();
    delete tmp.b;
    expected.push(tmp);  // 4
    expected.push(new Child('y', 'z')); // 5
    tmp = new Child('y');
    delete tmp.z;
    expected.push(tmp); // 6

    actual.forEach(function (obj, i) {
      mongo.request._pruneKeys(obj, keysToDelete);
      expect(obj).toEqual(expected[i]);
    });
    actual = {a: 'a', b: 'b'};
    mongo.request._pruneKeys(actual, []);
    expect(actual).toEqual({a: 'a', b: 'b'});
  });

  it('stringifies the keys of the given object', function () {
    var js = JSON.stringify;
    var actual =  [
      {str: 'a', number: 0, obj: {key: 'val'}},
      {}
    ];
    var expected = [
      {str: js('a'), number: js(0), obj: JSON.stringify({key: 'val'})},
      {}
    ];
    actual.forEach(function (obj, i) {
      mongo.request._stringifyKeys(obj);
      expect(obj).toEqual(expected[i]);
    });
  });
});


describe('A Shell', function () {
  var shells, instance, $rootElement;
  var rootElements;
  var SHELL_COUNT = 2;

  beforeEach(function () {
    shells = [];
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
        var $element = $(cssClass);
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

  describe('that has injected its HTML', function () {
    beforeEach(function () {
      instance.injectHTML();
      // This is cleaned up in the parent afterEach().
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
      var responseList = $rootElement.find(CONST.css.classes.responseList).get(
          0);
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
      var responseList = $rootElement.find(CONST.css.classes.responseList).get(
          0);
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
        expect(instance.insertResponseLine).toHaveBeenCalledWith(expected);
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


describe('The util module', function () {
  var KeyValProto = function () {};
  KeyValProto.prototype.key = 'val';

  describe('when providing console protection', function () {
    var CONSOLE_EXPANDED_FUNC = ['debug', 'error', 'info', 'warn'];
    var consoleStore;

    beforeEach(function () {
      consoleStore = console;
    });

    afterEach(function () {
      console = consoleStore;
      consoleStore = null;
    });

    it('does nothing if all of the console methods exist', function () {
      console = {log: function () {} };
      CONSOLE_EXPANDED_FUNC.forEach(function (key) {
        console[key] = function () {};
      });
      var old = console;
      mongo.util.enableConsoleProtection();
      expect(old).toEqual(console);
    });

    it('sets the expanded methods to log if one does not exist', function () {
      var logFunc = function () { return 'aoeu'; };
      var expected = {log: logFunc};
      CONSOLE_EXPANDED_FUNC.forEach(function (key) {
        expected[key] = logFunc;
      });

      for (var i = 0; i < CONSOLE_EXPANDED_FUNC.length; i++) {
        // Setup: Reset the console and remove one expanded method from the
        // console.
        console = {log: logFunc};
        var removeIndex = i;
        CONSOLE_EXPANDED_FUNC.forEach(function (key, index) {
          if (index === removeIndex) { return; }
          console[key] = function () {};
        });

        mongo.util.enableConsoleProtection();
        expect(console).toEqual(expected);
      }
    });

    var expectConsoleKeysToEqualFunction = function () {
      expect(console.log).toEqual(jasmine.any(Function));
      CONSOLE_EXPANDED_FUNC.forEach(function (key) {
        expect(console[key]).toEqual(jasmine.any(Function));
      });
    };

    it('sets all methods to a function if log doesn\'t exist', function () {
      console = {};
      mongo.util.enableConsoleProtection();
      expectConsoleKeysToEqualFunction();
    });

    it('sets all methods to a function if console is undefined', function () {
      console = undefined;
      mongo.util.enableConsoleProtection();
      expectConsoleKeysToEqualFunction();
    });
  });

  it('determines if a given variable is numeric', function () {
    var isNumeric = mongo.util.isNumeric;
    // 9007199254740992 is the max value in JavaScript's number type.
    var numeric = [-9007199254740992, -4, -1, 0, 1, 4, 9007199254740992];
    numeric.forEach(function (number) {
      expect(isNumeric(number)).toBe(true);
    });

    var nonNumeric = [undefined, null, NaN, [], {}, false, true, '0', '1',
        'number', [4], {key: 4}];
    nonNumeric.forEach(function (number) {
      expect(isNumeric(number)).toBe(false);
    });
  });

  it('merges the key-values pairs in two objects together', function () {
    var mergeObj = mongo.util.mergeObjects;

    expect(mergeObj()).toEqual({});
    var obj1 = {key: 'val'};
    expect(mergeObj(obj1)).toEqual({key: 'val'});
    var obj2 = {iu: 'jjang'};
    expect(mergeObj(obj1, obj2)).toEqual({key: 'val', iu: 'jjang'});
    var obj3 = {gd: 'top'};
    var mergedObj = {key: 'val', iu: 'jjang', gd: 'top'};
    expect(mergeObj(obj1, obj2, obj3)).toEqual(mergedObj);

    var collideObj1 = {key: 'value', iu: 'jjang'};
    var collideObj2 = {key: 'values', gd: 'top'};
    expect(mergeObj(obj1, collideObj1, collideObj2)).toEqual(mergedObj);

    var proto = new KeyValProto();
    expect(mergeObj(proto)).toEqual({});
    proto.iu = 'jjang';
    expect(mergeObj(proto)).toEqual({iu: 'jjang'});
    expect(mergeObj(proto, {key: 'value'})).toEqual({iu: 'jjang',
        key: 'value'});
  });

  it('adds the own properties of one object to another', function() {
    var aop = mongo.util._addOwnProperties;

    var obj = {};
    aop(obj, {});
    expect(obj).toEqual({});
    aop(obj, {key: 'val'});
    expect(obj).toEqual({key: 'val'});
    aop(obj, {iu: 'jjang', gd: 'top'});
    expect(obj).toEqual({key: 'val', iu: 'jjang', gd: 'top'});

    var proto = new KeyValProto();
    obj = {iu: 'jjang'};
    aop(obj, proto);
    expect(obj).toEqual({iu: 'jjang'});
    proto.gd = 'top';
    aop(obj, proto);
    expect(obj).toEqual({iu: 'jjang', gd: 'top'});
  });

  it('divides source code into statements based on range indicies',
      function () {
    var expected, sourceArr;
    expected = sourceArr = [
      'db.inventory.find({qty: 50});',
      'note that this does not need to be syntactically valid',
      ''
    ];
    var source = sourceArr.join('');

    var ast = {body: []};
    var startInd = 0, endInd;
    sourceArr.forEach(function (statement) {
      endInd = startInd + statement.length;
      ast.body.push({range: [startInd, endInd]});
      startInd = endInd;
    });

    var statements = mongo.util.sourceToStatements(source, ast);
    statements.forEach(function (statement, i) {
      expect(statement).toBe(expected[i]);
    });
  });
});
