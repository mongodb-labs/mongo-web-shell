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

    it('that works on null and undefined values', function () {
      expect(mongo.util.toString(null)).toEqual('null');
      expect(mongo.util.toString(undefined)).toEqual('undefined');
    });
  });

  it('can tell whether or not arrays are equal', function () {
    var a = [1, 2, 3];
    var b = [1, 2, 3];
    var c = [1, 3, 2];
    var d = [1, [2, 3]];
    var e = [1, [2, 3]];
    var f = [1, [3, 2]];
    var g = [[1, 2], 3];

    expect(mongo.util.arrayEqual(null, null)).toBe(true);
    expect(mongo.util.arrayEqual(undefined, undefined)).toBe(true);
    expect(mongo.util.arrayEqual(a, a)).toBe(true);

    expect(mongo.util.arrayEqual(a, null)).toBe(false);
    expect(mongo.util.arrayEqual(null, a)).toBe(false);

    expect(mongo.util.arrayEqual(a, b)).toBe(true);
    expect(mongo.util.arrayEqual(b, a)).toBe(true);

    expect(mongo.util.arrayEqual(a, c)).toBe(false);
    expect(mongo.util.arrayEqual(c, a)).toBe(false);

    expect(mongo.util.arrayEqual(a, d)).toBe(false);
    expect(mongo.util.arrayEqual(d, a)).toBe(false);

    // Performing shallow comparison, d and e should be different
    expect(mongo.util.arrayEqual(d, e)).toBe(false);
    expect(mongo.util.arrayEqual(e, d)).toBe(false);

    expect(mongo.util.arrayEqual(d, f)).toBe(false);
    expect(mongo.util.arrayEqual(f, d)).toBe(false);

    expect(mongo.util.arrayEqual(d, g)).toBe(false);
    expect(mongo.util.arrayEqual(g, d)).toBe(false);
  });

  describe('formatting query results', function () {
    it('stringifies normal objects', function () {
      var str = mongo.util.stringifyQueryResult({a: 1, foo: {bar: 'baz'}});
      var exp = '{"a": 1, "foo": {"bar": "baz"}}';
      expect(str).toEqual(exp);
    });

    it('puts the _id field first', function () {
      var str = mongo.util.stringifyQueryResult({a: 1, _id: 'foo'});
      var exp = '{"_id": "foo", "a": 1}';
      expect(str).toEqual(exp);
    });

    it('prints object ids properly', function () {
      var str = mongo.util.stringifyQueryResult({
        _id: {$oid: 'abcdef010123456789abcdef'},
        a: {b: {$oid: '0123456789abcdef01234567'}},
        b: {$oid: '0123456789abcdef0123456'}, // Too short
        c: {$oid: 12345678901234567890123}, // Not a string
        d: {$oid: 'abcdef010123456789abcdef', foo: 'bar'} // Extra keys
      });
      var exp = '{' +
        '"_id": ObjectId("abcdef010123456789abcdef"), ' +
        '"a": {"b": ObjectId("0123456789abcdef01234567")}, ' +
        '"b": {"$oid": "0123456789abcdef0123456"}, ' +
        '"c": {"$oid": 1.2345678901234568e+22}, ' +
        '"d": {"$oid": "abcdef010123456789abcdef", "foo": "bar"}' +
      '}';
      expect(str).toEqual(exp);
    });

    it('prints nonobjects', function(){
      [
        ['mongo', 'mongo'],
        [123, '123'],
        [false, 'false'],
        [true, 'true']
      ].forEach(function(e){
        expect(mongo.util.stringifyQueryResult(e[0])).toEqual(e[1]);
      });
    });

    it('works on null and undefined values', function () {
      expect(mongo.util.stringifyQueryResult(null)).toEqual('null');
      expect(mongo.util.stringifyQueryResult(undefined)).toEqual('undefined');
    });

    it('prints arrays', function(){
      var result = mongo.util.stringifyQueryResult([1, 2, 'red', 'blue']);
      expect(result).toEqual('[1, 2, red, blue]');
    });
  });

  describe('member getter', function () {
    var obj;
    beforeEach(function () {
      obj = {
        foo: 'test',
        __methodMissing: jasmine.createSpy('method missing')
      };
    });

    it('returns existing fields', function () {
      expect(mongo.util.__get(obj, 'foo')).toEqual('test');
    });

    it('binds returned functions properly', function () {
      var obj = {
        count: 0,
        incr: function () {
          this.count++;
        }
      };
      expect(obj.count).toEqual(0);
      mongo.util.__get(obj, 'incr')();
      expect(obj.count).toEqual(1);
    });

    it('returns undefined for non-existent fields if there is no method missing', function () {
      delete obj.__methodMissing;
      expect(mongo.util.__get(obj, 'bar')).toBeUndefined();
    });

    it('calls method missing, if defined, for non-existent fields', function () {
      mongo.util.__get(obj, 'foo');
      expect(obj.__methodMissing).not.toHaveBeenCalled();
      mongo.util.__get(obj, 'bar');
      expect(obj.__methodMissing).toHaveBeenCalledWith('bar');
    });
  });
});
