/* global afterEach, beforeEach, describe, expect, it, mongo, sinon */
/* global xdescribe */
$.ready = function () {}; // Prevent mongo.init() from running.

var CONST = {
  cssFile: 'mongo-web-shell.css'
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

  it('makes a post request for todo items', function () {
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
});


describe('A Cursor', function () {
  // TODO: Test.
});


describe('The dom module', function () {
  it('retrives the shell configuration from the DOM', function () {
    // TODO: Test more than the default values.
    var config = mongo.dom.retrieveConfig();
    // Default values.
    expect(config.cssPath).toBe(CONST.cssFile);
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
    expectAbsentCSS(CONST.cssFile);
    mongo.dom.injectStylesheet(CONST.cssFile);
    var injected = $('head').children().get(0); // Expect to be prepended.
    expect(injected.tagName).toBe('LINK');
    expect(injected.href).toMatch(CONST.cssFile + '$');
    expect(injected.rel).toBe('stylesheet');
    expect(injected.type).toBe('text/css');

    // Clean up.
    injected.parentNode.removeChild(injected);
    expectAbsentCSS(CONST.cssFile);
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
  // TODO: Test.
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

    var throwerFunc = [
      function () { mongo.request._pruneKeys(null, ['key']); },
      function () { mongo.request._pruneKeys({}, null); }
    ];
    throwerFunc.forEach(function (func) {
      expect(func).toThrow();
    });
  });

  it('stringifies the keys of the given object', function () {
    // TODO: Use stringify rather than creating the output by hand.
    // TODO: Pass in an object with a prototype.
    // TODO: In general, more tests.
    var a = {'a':{1:2}};
    var res = {'a':'{"1":2}'};
    mongo.request._stringifyKeys(a);
    expect(a).toEqual(res);
  });
});


describe('A Shell', function () {
  // TODO: Test untested methods.
  it('injects its HTML into the DOM', function () {
    // TODO: Clean this up.
    var mwsBorder = $('.mws-border');
    expect(mwsBorder.length).toEqual(0);
    var shell = new mongo.Shell($('.mongo-web-shell'));
    shell.injectHTML();
    mwsBorder = $('.mws-border');
    expect(mwsBorder.length).toEqual(1);
    expect(mwsBorder.find('.mshell').length).toEqual(1);
    expect(mwsBorder.find('.mshell').find('.mws-input').length).toEqual(1);
  });
});


describe('The util module', function () {
  it('divides source code into statements', function () {
    // TODO: Clean this up.
    var ast = {};
    var str0 = 'db.inventory.find( { qty: 50 } )';
    var str1 = 'db.collection.totalSize()';
    var str2 = 'db.products.update( { item: "book", qty: { $gt: 5 } } )';
    var src  = str0 + str1 + str2;
    var params  = {};
    var params1 = {};
    var params2 = {};
    ast.body = [];
    params.range  = {0:0, 1:str0.length};
    params1.range = {0:str0.length, 1:str0.length+str1.length};
    params2.range = {0:str0.length+str1.length, 1:(src.length)};
    ast.body.push(params);
    ast.body.push(params1);
    ast.body.push(params2);
    var statements = mongo.util.sourceToStatements(src, ast);
    expect(statements[0]).toEqual(str0);
    expect(statements[1]).toEqual(str1);
    expect(statements[2]).toEqual(str2);
  });
});
