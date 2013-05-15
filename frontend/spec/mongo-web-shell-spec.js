/* jshint camelcase: false, loopfunc: true */
/* global afterEach, beforeEach, describe, expect, falafel, it, jasmine */
/* global mongo, sinon, spyOn, xit */
$.ready = function () {}; // Prevent mongo.init() from running.
var console; // Avoid errors from util.enableConsoleProtection if console DNE.

var esprima; // stubbed where applicable.

var CONST = {
  css: {
    classes: {
      root: 'mongo-web-shell',
      internal: [
        'mws-wrapper',
        'mws-topbar',
        'mws-hide-button',
        'mws-body',
        'mws-scrollbar-spacer',
        'mws-response-list',
        'input-li',
        'mws-form',
        'mws-input'
      ],
      responseList: 'mws-response-list'
    }
  },
  domConfig: {
    dataAttrKeys: {
      cssPath: 'css-path',
      mwsHost: 'mws-host'
    },
    defaults: {
      cssPath: 'mongo-web-shell.css',
      mwsHost: '',
      baseUrlPostfix: '/mws/'
    }
  },
  scriptName: 'mongo-web-shell.js'
};


describe('The init function', function () {
  var creationSuccess, dataObj = {res_id: 'iu'};
  var mwsHost = 'host';
  var expected = {
    config: {
      cssPath: 'css',
      mwsHost: mwsHost,
      baseUrl: mwsHost + CONST.domConfig.baseUrlPostfix
    }
  };

  beforeEach(function () {
    jasmine.Clock.useMock();
    spyOn(mongo.dom, 'injectStylesheet');
    spyOn(mongo.dom, 'retrieveConfig').andReturn(expected.config);
    spyOn(mongo.request, 'createMWSResource').andCallFake(function (
        shell, onSuccess) {
      if (creationSuccess) {
        onSuccess(dataObj);
      }
    });
    spyOn(mongo.util, 'enableConsoleProtection');
    creationSuccess = false; // Avoids running additional code on each request.
  });

  afterEach(function () {
    mongo.config = null;
    mongo.shells = [];
  });

  it('enables console protection', function () {
    mongo.init();
    expect(mongo.dom.retrieveConfig).toHaveBeenCalled();
  });

  it('retrieves and sets the script configuration', function () {
    mongo.init();
    expect(mongo.dom.retrieveConfig).toHaveBeenCalled();
    expect(mongo.config).toEqual(expected.config);
  });

  it('injects the web shell stylesheet', function () {
    mongo.init();
    expect(mongo.dom.injectStylesheet).toHaveBeenCalledWith(
        expected.config.cssPath);
  });

  describe('for each web shell div in the DOM', function () {
    var SHELL_COUNT = 3;
    var shellSpy, shellElements;

    beforeEach(function () {
      shellElements = [];
      for (var i = 0; i < SHELL_COUNT; i++) {
        var element = document.createElement('div');
        element.className = CONST.css.classes.root;
        document.body.appendChild(element);
        shellElements[i] = element;
      }
      shellSpy = jasmine.createSpyObj('Shell', [
        'attachClickListener',
        'attachHideButtonHandler',
        'attachInputHandler',
        'enableInput',
        'injectHTML',
        'keepAlive'
      ]);
      spyOn(mongo, 'Shell').andReturn(shellSpy);
    });

    afterEach(function () {
      shellElements.forEach(function (element) {
        element.parentNode.removeChild(element);
      });
      shellElements = null;
    });

    it('constructs a new shell', function () {
      mongo.init();
      expect(mongo.Shell.calls.length).toBe(SHELL_COUNT);
      shellElements.forEach(function (element, i) {
        expect(mongo.Shell).toHaveBeenCalledWith(element, i);
        expect(mongo.shells[i]).toBeDefined();
      });
      expect(shellSpy.injectHTML.calls.length).toBe(SHELL_COUNT);
      expect(shellSpy.attachClickListener.calls.length).toBe(SHELL_COUNT);
      expect(shellSpy.attachHideButtonHandler.calls.length).toBe(SHELL_COUNT);
    });

    it('attaches and enables input handlers on mws resource creation',
        function () {
      // Unsuccessful creation.
      mongo.init();
      expect(shellSpy.attachInputHandler).not.toHaveBeenCalled();
      expect(shellSpy.enableInput).not.toHaveBeenCalled();
      jasmine.Clock.tick(mongo.const.keepAliveTime);
      expect(shellSpy.keepAlive).not.toHaveBeenCalled();

      creationSuccess = true;
      mongo.init();
      expect(shellSpy.attachInputHandler.calls.length).toBe(SHELL_COUNT);
      expect(shellSpy.attachInputHandler).toHaveBeenCalledWith(dataObj.res_id);
      expect(shellSpy.enableInput.calls.length).toBe(SHELL_COUNT);
      expect(shellSpy.enableInput).toHaveBeenCalledWith(true);
      jasmine.Clock.tick(mongo.const.keepAliveTime - 1);
      expect(shellSpy.keepAlive).not.toHaveBeenCalled();
      jasmine.Clock.tick(1);
      expect(shellSpy.keepAlive).toHaveBeenCalled();
    });
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

  it('stores the root element CSS selector', function () {
    expect(mongo.const.rootElementSelector).toBeDefined();
  });

  it('stores the script name', function () {
    expect(mongo.const.scriptName).toBeDefined();
  });

  it('stores the shell batch size', function () {
    expect(mongo.const.shellBatchSize).toBeDefined();
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
  var dataAttrKeys = CONST.domConfig.dataAttrKeys;
  var defaults = CONST.domConfig.defaults;

  it('retrives the shell configuration from the DOM', function () {
    var actual = mongo.dom.retrieveConfig();
    expect(actual.cssPath).toBe(defaults.cssPath);
    expect(actual.mwsHost).toBe(defaults.mwsHost);
    expect(actual.baseUrl).toBe(defaults.mwsHost + defaults.baseUrlPostfix);

    var expected = {cssPath: 'css', mwsHost: 'host'};
    expected.baseUrl = expected.mwsHost + defaults.baseUrlPostfix;
    var $script = $('script[src*=\'' + CONST.scriptName + '\']');
    var key;
    for (key in dataAttrKeys) {
      if (dataAttrKeys.hasOwnProperty(key)) {
        $script.data(dataAttrKeys[key], expected[key]);
      }
    }
    actual = mongo.dom.retrieveConfig();
    for (key in expected) {
      if (expected.hasOwnProperty(key)) {
        expect(actual[key]).toBe(expected[key]);
      }
    }
  });

  it('injects a stylesheet into the DOM', function () {
    function expectAbsentCSS(cssFile) {
      $('link').each(function (index, linkElement) {
        expect(linkElement.href).not.toBe(cssFile);
      });
    }

    expectAbsentCSS(defaults.cssPath);
    mongo.dom.injectStylesheet(defaults.cssPath);
    var injected = $('head').children().get(0); // Expect to be prepended.
    expect(injected.tagName).toBe('LINK');
    expect(injected.href).toMatch(defaults.cssPath + '$');
    expect(injected.rel).toBe('stylesheet');
    expect(injected.type).toBe('text/css');

    // Clean up.
    injected.parentNode.removeChild(injected);
    expectAbsentCSS(defaults.cssPath);
  });
});


describe('The keyword module', function () {
  // TODO: Test.
});


describe('The mutateSource module', function () {
  var ms = mongo.mutateSource;

  /**
   * Returns an AST generated by falafel and all nodes of the specified type.
   * If the type is not specified, an empty array is returned.
   *
   * falafel adds attributes such as node.parent which many of the methods
   * under testing rely upon so esprima cannot be used be itself. However,
   * falafel does not return its AST directly, so this method takes the root
   * from the last node visited in the reverse traversal (leaf to root).
   */
  function getFalafelAST(source, nodeType) {
    var root, nodes = [];
    falafel(source, function (node) {
      root = node;
      if (nodeType && node.type === nodeType) { nodes.push(node); }
    });
    return {ast: root, nodes: nodes};
  }

  it('hides global func declarations within a Shell variable', function () {
    var source = 'function a(b, c) { function d(e) { return 4; } }';
    var shellID = 0;
    var expected = 'mongo.shells[' + shellID + '].vars.a = function (b, c) ' +
        '{ function d(e) { return 4; } }';
    expected = expected.replace(/\s+/g, '');

    var out = getFalafelAST(source, 'FunctionDeclaration');
    out.nodes.forEach(function (node) {
      ms._mutateFunctionDeclaration(node, shellID);
    });
    var actual = out.ast.source().replace(/\s+/g, '');
    expect(actual).toEqual(expected);
  });

  it('hides global identifiers within a Shell variable', function () {
    var source = 'var a; b = 0; function c(d) { e = f; var g; } h.h = 2; ' +
        'i = {j: 3}; mongo.keyword = 4; mongo.keyword.evaluate();';
    var shellID = 0;
    var shell = 'mongo.shells[' + shellID + '].vars.';
    var expected = 'var ' + shell + 'a; ' + shell + 'b = 0; function c(d) { ' +
        shell + 'e = ' + shell + 'f; var g; } ' + shell + 'h.h = 2; ' + shell +
        'i ' + '= {j: 3}; ' + shell + 'mongo.keyword = 4; ' +
        'mongo.keyword.evaluate();';
    expected = expected.replace(/\s+/g, '');

    var out = getFalafelAST(source, 'Identifier');
    out.nodes.forEach(function (node) {
      ms._mutateIdentifier(node, shellID);
    });
    var actual = out.ast.source().replace(/\s+/g, '');
    expect(actual).toEqual(expected);
  });

  it('gets the local variable identifiers of the current node', function () {
    var source =
        'var global;' +
        'global2 = 2;' +
        'function one(a) {' +
          'global3 = 3;' +
          'var b, c = 3;' +
          'var d = function (x) {' +
            'global4 = 4;' +
            'var y, z = 4;' +
          '}' +
        '}';
    var ast = getFalafelAST(source).ast;
    var scope = {
      top: ast.body[0],
      mid: ast.body[2].body.body[0],
      bottom: ast.body[2].body.body[2].declarations[0].init.body.body[0]
    };
    var expected = {
      top: {},
      mid: {one: true, a: true, b: true, c: true, d: true},
      bottom: {one: true, a: true, b: true, c: true, d: true, x: true, y: true,
        z: true}
    };
    for (var key in expected) {
      if (expected.hasOwnProperty(key)) {
        expect(ms._getLocalVariableIdentifiers(scope[key])).toEqual(
            expected[key]);
      }
    }
  });

  describe('working with identifiers', function () {
    var funcNode;

    beforeEach(function () {
      var source = 'function a(aa, bb, cc) { var b, c; var d; }' +
          'var e = function f(dd, ee, ff) { var g; };';
      var ast = getFalafelAST(source).ast;
      funcNode = {
        a: ast.body[0],
        f: ast.body[1].declarations[0].init
      };
    });

    afterEach(function () {
      funcNode = null;
    });

    it('extracts identifiers of parameters to a function', function () {
      var expected = {
        a: {aa: true, bb: true, cc: true},
        f: {dd: true, ee: true, ff: true}
      };
      for (var key in expected) {
        if (expected.hasOwnProperty(key)) {
          var paramsNode = funcNode[key].params;
          expect(ms._extractParamsIdentifiers(paramsNode)).toEqual(
              expected[key]);
        }
      }
    });

    it('extracts identifiers in the body of a function', function () {
      var expected = {
        a: {b: true, c: true, d: true},
        f: {g: true}
      };
      for (var key in expected) {
        if (expected.hasOwnProperty(key)) {
          var bodyNode = funcNode[key].body;
          expect(ms._extractBodyIdentifiers(bodyNode)).toEqual(expected[key]);
        }
      }
    });
  });

  describe('working with containing functions', function () {
    var varDeclNode, topFnNode, bottomFnNode, returnNode;

    beforeEach(function () {
      var source = [
        'var iu = \'<3\';',
        'function four() { var n = function () { return 4; }; return n(); }'
      ].join(' ');
      var ast = getFalafelAST(source).ast;
      varDeclNode = ast.body[0];
      topFnNode = ast.body[1];
      bottomFnNode = topFnNode.body.body[0].declarations[0].init;
      returnNode = bottomFnNode.body.body[0];
    });

    afterEach(function () {
      varDeclNode = topFnNode = bottomFnNode = returnNode = null;
    });

    it('gets the containing function node of the current one', function () {
      expect(ms._getContainingFunctionNode(varDeclNode)).toBeNull();

      expect(ms._getContainingFunctionNode(returnNode)).toEqual(bottomFnNode);
      expect(ms._getContainingFunctionNode(bottomFnNode)).toEqual(topFnNode);
      expect(ms._getContainingFunctionNode(topFnNode)).toBeNull();
    });

    it('says whether a node is contained within a function node', function () {
      expect(ms._nodeIsInsideFunction(varDeclNode)).toBe(false);
      expect(ms._nodeIsInsideFunction(returnNode)).toBe(true);
    });
  });
});


describe('A Query', function () {
  var instance, shellSpy, collectionName, requestStore;

  beforeEach(function () {
    requestStore = mongo.request;
    mongo.request = jasmine.createSpyObj('request', ['dbCollectionFind',
        'dbCollectionInsert']);
    spyOn(mongo, 'Cursor').andCallThrough();

    shellSpy = jasmine.createSpy('shell');
    collectionName = 'collectionName';
    instance = new mongo.Query(shellSpy, collectionName);
  });

  afterEach(function () {
    mongo.request = requestStore;
    requestStore = null;
  });

  it('can return a Cursor for finding within a collection', function () {
    var query = '{iu: "jjang"}', projection = '{_id: 0}';
    var args = {query: query, projection: projection};
    var actual = instance.find(query, projection);
    expect(mongo.Cursor).toHaveBeenCalledWith(instance,
        mongo.request.dbCollectionFind, args);
    expect(actual).toEqual(jasmine.any(mongo.Cursor));
    expect(mongo.request.dbCollectionFind).not.toHaveBeenCalled();
  });

  it('can make a request to insert into a collection', function () {
    var document_ = '{iu: "jjang"}';
    instance.insert(document_);
    expect(mongo.request.dbCollectionInsert).toHaveBeenCalledWith(instance,
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
  var RES_URL = 'resURL/';
  var configStore;

  beforeEach(function () {
    spyOn(mongo.util, 'getDBCollectionResURL').andReturn(RES_URL);
    spyOn(mongo.util, 'pruneKeys');
    spyOn(mongo.util, 'stringifyKeys');
    configStore = mongo.config;
    mongo.config = {};
  });

  afterEach(function () {
    mongo.config = configStore;
    configStore = null;
  });

  /**
   * Valids the requests themselves, rather than the actions taken upon their
   * failure or success.
   */
  describe('creates a request that', function () {
    var requests, xhr;

    beforeEach(function () {
      xhr = sinon.useFakeXMLHttpRequest();
      xhr.onCreate = function (xhr) { requests.push(xhr); };
      requests = [];
    });

    afterEach(function () {
      requests = null;
      xhr.restore();
    });

    it('creates an MWS resource', function () {
      var baseUrl = '/mws/';
      mongo.config.baseUrl = baseUrl;
      var callbackSpy = jasmine.createSpy('callback');
      var shellSpy = jasmine.createSpyObj('Shell', ['insertResponseLine']);

      mongo.request.createMWSResource(shellSpy, callbackSpy);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('POST');
      expect(req.url).toBe(baseUrl);
      expect(req.requestBody).toBe(null);

      var body = {res_id: 'iu'};
      // TODO: FF23 complains 'not well-formed' for response body, but
      // continues testing anyway. Chromium is fine.
      req.respond(200, '', JSON.stringify(body));
      expect(callbackSpy).toHaveBeenCalledWith(body);
      expect(shellSpy.insertResponseLine).not.toHaveBeenCalled();

      // Failure: invalid data.
      mongo.request.createMWSResource(shellSpy, callbackSpy);
      req = requests[1];
      req.respond(200, '', JSON.stringify({daebak: 'iu'}));
      expect(shellSpy.insertResponseLine).toHaveBeenCalled();

      // Failure: HTTP error.
      mongo.request.createMWSResource(shellSpy, callbackSpy);
      req = requests[2];
      req.respond(404, '', '');
      expect(shellSpy.insertResponseLine.calls.length).toBe(2);

      expect(callbackSpy.calls.length).toBe(1);
    });

    it('calls db.collection.find() on the database', function () {
      var cursor = {
        _query: {args: {projection: {_id: 0}, query: {iu: 'jjang'}}},
        _shell: jasmine.createSpyObj('Shell', ['insertResponseLine']),
        _storeQueryResult: jasmine.createSpy('storeQueryResult')
      };
      var callbackSpy = jasmine.createSpy('callback');
      var async = true;

      mongo.request.dbCollectionFind(cursor, callbackSpy, async);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('GET');
      var actualURL = decodeURIComponent(req.url);
      expect(actualURL).toMatch('^' + RES_URL + 'find?');
      expect(actualURL).toMatch('find?.*projection\\[_id\\]=' +
          cursor._query.args.projection._id);
      expect(actualURL).toMatch('find?.*query\\[iu\\]=' +
          cursor._query.args.query.iu);
      expect(req.requestBody).toBe(null);
      expect(req.async).toBe(async);
      expect(req.requestHeaders.Accept).toMatch('application/json');
      expect(callbackSpy).not.toHaveBeenCalled();

      async = false;
      mongo.request.dbCollectionFind(cursor, callbackSpy, async);
      req = requests[1];
      expect(req.async).toBe(async);
      expect(callbackSpy).not.toHaveBeenCalled();

      req = requests[0];
      var expectedResult = [{iu: 'jjang'}, {exo: 'k'}];
      // TODO: This status code is undocumented.
      var body = {status: 0, result: expectedResult};
      req.respond(200, '', JSON.stringify(body));
      expect(cursor._storeQueryResult).toHaveBeenCalledWith(expectedResult);
      expect(callbackSpy).toHaveBeenCalled();
      expect(cursor._shell.insertResponseLine).not.toHaveBeenCalled();

      // Failure: HTTP Error.
      // XXX: req.respond only seems to work if async === true.
      mongo.request.dbCollectionFind(cursor, callbackSpy, true);
      req = requests[2];
      req.respond(404, '', JSON.stringify(body));
      expect(cursor._storeQueryResult.call.length).toBe(1);
      expect(callbackSpy.calls.length).toBe(1);
      expect(cursor._shell.insertResponseLine).toHaveBeenCalled();
      // TODO: How to catch the exception?

      // Failure: Bad status code.
      body = {status: -1, result: expectedResult};
      mongo.request.dbCollectionFind(cursor, callbackSpy, true);
      req = requests[3];
      req.respond(200, '', JSON.stringify(body));
      expect(cursor._storeQueryResult.call.length).toBe(1);
      expect(callbackSpy.calls.length).toBe(1);
      expect(cursor._shell.insertResponseLine.calls.length).toBe(2);
    });

    it('calls db.collection.insert() on the database', function () {
      var query = {
        shell: jasmine.createSpyObj('Shell', ['insertResponseLine'])
      };
      var document_ = 'doc';
      mongo.request.dbCollectionInsert(query, document_);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('POST');
      expect(req.url).toBe(RES_URL + 'insert');
      var expectedParams = JSON.stringify({document: document_});
      expect(req.requestBody).toMatch(expectedParams);
      expect(req.requestHeaders.Accept).toMatch('application/json');
      expect(req.requestHeaders['Content-Type']).toMatch('application/json');

      req.respond(200, '', '{}');
      expect(query.shell.insertResponseLine).not.toHaveBeenCalled();

      // Failure: HTTP error.
      mongo.request.dbCollectionInsert(query, document_);
      req = requests[1];
      req.respond(404, '', '{}');
      expect(query.shell.insertResponseLine).toHaveBeenCalled();
    });

    it('keeps the shell mws resource alive', function () {
      mongo.config.baseUrl = 'base';
      var shell = {mwsResourceID: 'iu'};
      var expectedURL = mongo.config.baseUrl + shell.mwsResourceID +
          '/keep-alive';
      mongo.request.keepAlive(shell);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('POST');
      expect(req.url).toBe(expectedURL);
      expect(req.requestBody).toBe(null);
      // There is nothing to test for if the request succeeds or not.
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

  describe('that has injected its HTML', function () {
    beforeEach(function () {
      instance.injectHTML();
      // This is cleaned up in the parent afterEach().
    });

    it('attaches a click listener', function () {
      spyOn(instance, 'onClick');
      instance.attachClickListener();
      instance.$body.trigger('click');
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

  it('creates a resource URL from the given parameters', function () {
    var configStore = mongo.config;
    var gru = mongo.util.getDBCollectionResURL;
    mongo.config = {baseUrl: '/kpop/'};
    expect(gru('iu', 'jjang')).toBe('/kpop/iu/db/jjang/');
    mongo.config = {baseUrl: 'mws/'};
    expect(gru(30, 2)).toBe('mws/30/db/2/');
    expect(gru(null)).toBe('mws/null/db/undefined/');
    mongo.config = {baseUrl: 123};
    expect(gru('a', 'b')).toBe('123a/db/b/');
    mongo.config = configStore;
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
      mongo.util.pruneKeys(obj, keysToDelete);
      expect(obj).toEqual(expected[i]);
    });
    actual = {a: 'a', b: 'b'};
    mongo.util.pruneKeys(actual, []);
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
      mongo.util.stringifyKeys(obj);
      expect(obj).toEqual(expected[i]);
    });
  });
});
