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

  describe('provides an interface for stringifying objects that', function(){
    it('prints nonobjects', function(){
      [
        ['mongo', 'mongo'],
        [123, '123'],
        [false, 'false'],
        [true, 'true']
      ].forEach(function(e){
        expect(mongo.util.toString(e[0])).toEqual(e[1]);
      });
    });

    it('prints stringified objects', function(){
      [
        [{}, '{ }'],
        [{name: 'mongo'}, '{ "name" : "mongo" }'],
        [{parent: {nested: {key: 'val'}}}, '{ "parent" : { "nested" : { "key" : "val" } } }']
      ].forEach(function(e){
        expect(mongo.util.toString(e[0])).toEqual(e[1]);
      });
    });

    it('it uses the toString for objects for which it is a function', function(){
      function A(){}
      A.prototype.toString = function(){ return 'hello!'; };
      var a = new A();
      expect(mongo.util.toString(a)).toEqual('hello!');
    });

    it('refuses to print circular structures', function(){
      var a = {};
      a.a = a;
      expect(mongo.util.toString(a)).toMatch(/^ERROR: /);
    });

    it('works on null and undefined values', function () {
      expect(mongo.util.toString(null)).toEqual('null');
      expect(mongo.util.toString(undefined)).toEqual('undefined');
    });

    it('puts the _id field first', function () {
      var str = mongo.util.toString({a: 1, _id: 'foo'});
      var exp = '{ "_id" : "foo", "a" : 1 }';
      expect(str).toEqual(exp);
    });

    it('prints object ids properly', function () {
      var original = [
        {_id: {$oid: 'abcdef010123456789abcdef'}},
        {a: {b: {$oid: '0123456789abcdef01234567'}}},
        {b: {$oid: '0123456789abcdef0123456'}}, // Too short
        {c: {$oid: 12345678901234567890123}}, // Not a string
        {d: {$oid: 'abcdef010123456789abcdef', foo: 'bar'}} // Extra keys
      ];
      var results = $.map(original, mongo.util.toString);

      var exp = [
        '{ "_id" : ObjectId("abcdef010123456789abcdef") }',
        '{ "a" : { "b" : ObjectId("0123456789abcdef01234567") } }',
        '{ "b" : { "$oid" : "0123456789abcdef0123456" } }',
        '{ "c" : { "$oid" : 1.2345678901234568e+22 } }',
        '{ "d" : { "$oid" : "abcdef010123456789abcdef", "foo" : "bar" } }'
      ];
      for (var i = 0; i < results.length; i++) {
        expect(results[i]).toEqual(exp[i]);
      }
    });

    it('prints nonobjects', function(){
      [
        ['mongo', 'mongo'],
        [123, '123'],
        [false, 'false'],
        [true, 'true']
      ].forEach(function(e){
        expect(mongo.util.toString(e[0])).toEqual(e[1]);
      });
    });

    it('works on null and undefined values', function () {
      expect(mongo.util.toString(null)).toEqual('null');
      expect(mongo.util.toString(undefined)).toEqual('undefined');
    });

    it('prints arrays', function(){
      var result = mongo.util.toString([1, 2, 'red', 'blue']);
      expect(result).toEqual('[ 1, 2, "red", "blue" ]');
    });

    it('pretty prints long outputs', function () {
      // More than 80 char output string
      var original = {
        'this is a very long key': 'this is a very long value',
        'this is also a very long key': 'this is also a very long value'
      };
      var expected = '{\n' +
        '\t"this is a very long key" : "this is a very long value",\n' +
        '\t"this is also a very long key" : "this is also a very long value"\n' +
      '}';
      expect(mongo.util.toString(original)).toEqual(expected);
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
