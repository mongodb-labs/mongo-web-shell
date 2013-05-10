/* jshint loopfunc: true */
/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, sinon */
/* global spyOn, xdescribe, xit */
$.ready = function () {}; // Prevent mongo.init() from running.
var console; // Avoid errors from util.enableConsoleProtection if console DNE.

var CONST = {
  css: {
    file: 'mongo-web-shell.css',
    classes: {
      root: '.mongo-web-shell',
      internal: [
        '.mws-border',
        '.mshell',
        '.mws-in-shell-response',
        '.mws-input'
      ]
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
  // TODO: Test.
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
  // TODO: Test.
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

    describe('that are down', function () {
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
  // TODO: Test untested methods.
  // TODO: Embed a describe that injects for multiple shells in setup.
  var shells;
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
  });

  afterEach(function () {
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
