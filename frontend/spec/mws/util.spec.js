/* jshint loopfunc: true */
/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo */
var console; // Stubbed later.
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

  describe('provides an interface for stringifying objects', function(){
    it('that prints nonobjects', function(){
      [
        ['mongo', 'mongo'],
        [123, '123'],
        [false, 'false'],
        [true, 'true']
      ].forEach(function(e){
        expect(mongo.util.toString(e[0])).toEqual(e[1]);
      });
    });

    it('that prints stringified objects', function(){
      [
        [{}, '{}'],
        [{name: 'mongo'}, '{"name":"mongo"}'],
        [{parent: {nested: {key: 'val'}}}, '{"parent":{"nested":{"key":"val"}}}']
      ].forEach(function(e){
        expect(mongo.util.toString(e[0])).toEqual(e[1]);
      });
    });

    it('that it uses the toString for objects for which it is a function', function(){
      function A(){}
      A.prototype.toString = function(){ return 'hello!'; };
      var a = new A();
      expect(mongo.util.toString(a)).toEqual('hello!');
    });

    it('that refuses to print circular structures', function(){
      var a = {};
      a.a = a;
      expect(mongo.util.toString(a)).toMatch(/^ERROR: /);
    });
  });
});
