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

/* global beforeEach, describe, expect, it, jasmine, mongo, spyOn */
describe('A Cursor', function () {
  var instance, batchSize;
  var getShellBatchSizeSpy, insertResponseLineSpy, makeRequest;
  var coll, result;

  beforeEach(function () {
    batchSize = 2;
    insertResponseLineSpy = jasmine.createSpy('insertResponseLine');
    getShellBatchSizeSpy = jasmine.createSpy('getShellBatchSize').andCallFake(
        function () {
      return batchSize;
    });
    coll = {
      shell: {
        getShellBatchSize: getShellBatchSizeSpy,
        insertResponseLine: insertResponseLineSpy,
        lastUsedCursor: null
      },
      urlBase: 'coll_url_base/'
    };
    instance = new mongo.Cursor(coll);

    result = {
      result: ['test', 'results', 'here']
    };
    makeRequest = spyOn(mongo.request, 'makeRequest').andCallFake(function () {
      var success = arguments[5];
      if (success) {
        success(result);
      }
    });
  });

  it('can represent itself as a string', function () {
    coll.toString = function () {return 'my.name.space';};
    expect(instance.toString()).toEqual('Cursor: my.name.space -> { }');
    instance = new mongo.Cursor(coll, {test: 'query'});
    expect(instance.toString()).toEqual('Cursor: my.name.space -> { "test" : "query" }');
  });

  it('stores a query result', function () {
    var results = ['a', 'series', 'of', 'results'];
    result.result = results.slice(0);
    instance._executeQuery();
    for (var i = 0; i < results.length; i++) {
      expect(instance.hasNext()).toBe(true);
      expect(instance.next()).toEqual(results[i]);
    }
    expect(instance.hasNext()).toBe(false);
  });

  it('requires skipped amount to be an integer', function () {
    var illegalValues = ['hello', 1.123, true, {a: 'b'}];
    $.each(illegalValues, function (i, value) {
      expect(function () {instance.skip(value);}).toThrow('Skip amount must be an integer.');
    });
  });

  it('requires limited amount to be an integer', function () {
    var illegalValues = ['hello', 1.123, true, {a: 'b'}];
    $.each(illegalValues, function (i, value) {
      expect(function () {instance.limit(value);}).toThrow('Limit amount must be an integer.');
    });
  });

  describe('depending on query state', function () {
    var callbackSpy;

    beforeEach(function () {
      callbackSpy = jasmine.createSpy('callback');
    });

    describe('on first execution', function () {
      it('uses the collection url', function () {
        coll.urlBase = 'my_coll_url/';
        instance._executeQuery();
        expect(makeRequest.calls[0].args[0]).toEqual(coll.urlBase + 'find');
      });

      it('constructs appropriate params', function () {
        var query = {count: {$gt: 5}};
        var projection = {_id: 0, name: 1};

        instance = new mongo.Cursor(coll, query, projection);
        instance._executeQuery();
        var params = makeRequest.mostRecentCall.args[1];
        expect(params.query).toEqual(query);
        expect(params.projection).toEqual(projection);

        instance = new mongo.Cursor(coll, query);
        instance._executeQuery();
        params = makeRequest.mostRecentCall.args[1];
        expect(params.query).toEqual(query);
        expect(params.projection).toBeUndefined();

        instance = new mongo.Cursor(coll);
        instance._executeQuery();
        params = makeRequest.mostRecentCall.args[1];
        expect(params.query).toBeUndefined();
        expect(params.projection).toBeUndefined();
      });

      it('will skip results', function () {
        instance._executeQuery();
        var params = makeRequest.mostRecentCall.args[1];
        expect(params.skip).toBeUndefined();

        instance = new mongo.Cursor(coll);
        var result = instance.skip(7);
        expect(result).toBe(instance);
        instance._executeQuery();
        params = makeRequest.mostRecentCall.args[1];
        expect(params.skip).toEqual(7);
      });

      it('will limit results', function () {
        instance._executeQuery();
        var params = makeRequest.mostRecentCall.args[1];
        expect(params.limit).toBeUndefined();

        instance = new mongo.Cursor(coll);
        var result = instance.limit(12);
        expect(result).toBe(instance);
        instance._executeQuery();
        params = makeRequest.mostRecentCall.args[1];
        expect(params.limit).toEqual(12);
      });

      it('uses the get HTTP method', function () {
        instance._executeQuery();
        expect(makeRequest.calls[0].args[2]).toEqual('GET');
      });

      it('uses the collection\'s shell', function () {
        instance._executeQuery();
        expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
      });

      it('uses the supplied on async flag', function () {
        var async = true;
        instance._executeQuery(null, async);
        expect(instance._executed).toBe(true);
        expect(makeRequest.calls[0].args[6]).toBe(async);

        async = false;
        instance._executed = false;
        instance._executeQuery(null, async);
        expect(instance._executed).toBe(true);
        expect(makeRequest.calls[1].args[6]).toBe(async);
      });

      it('executes default asynchronous queries', function () {
        instance._executeQuery(callbackSpy);
        expect(instance._executed).toBe(true);
        expect(makeRequest.calls[0].args[6]).toEqual(true);
      });

      it('calls the on success callback', function () {
        instance._executeQuery(callbackSpy);
        expect(instance._executed).toBe(true);
        expect(callbackSpy).toHaveBeenCalled();
      });

      it('fires the callback event', function(){
        var ct = spyOn(mongo.events, 'callbackTrigger');
        instance._executeQuery();
        expect(ct).toHaveBeenCalledWith(coll.shell, 'cursor.execute', [
          'test', 'results', 'here'
        ]);
      });

      it('does not warn the user and returns false', function () {
        var actual = instance._warnIfExecuted('methodName');
        expect(actual).toBe(false);
        expect(insertResponseLineSpy).not.toHaveBeenCalled();
      });

      describe('will execute a query when it', function () {
        beforeEach(function () {
          spyOn(instance, '_executeQuery').andCallThrough();
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

        it('creates an array of the results', function () {
          instance.toArray();
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
        instance._executed = true;
      });

      it('does not re-execute and calls the on success callback', function () {
        instance._executeQuery(callbackSpy);
        expect(instance._executed).toBe(true);
        expect(makeRequest).not.toHaveBeenCalled();
        expect(callbackSpy).toHaveBeenCalled();
      });

      it('warns the user and returns true', function () {
        var actual = instance._warnIfExecuted('methodName');
        expect(actual).toBe(true);
        expect(insertResponseLineSpy).toHaveBeenCalled();
      });

      it('does not allow skipping of results', function () {
        expect(function () {
          instance.skip(3);
        }).toThrow('Cannot skip results after query has been executed.');
      });

      it('does not allow limiting of results', function () {
        expect(function () {
          instance.limit(3);
        }).toThrow('Cannot limit results after query has been executed.');
      });

      describe('calls a success callback that', function () {
        var RESULTS = '123456'.split('');

        beforeEach(function () {
          instance._storeQueryResult(RESULTS.slice(0)); // A copy.
          instance._executed = true;
          spyOn(instance, '_executeQuery').andCallThrough();
        });

        it('prints the next batch of results', function () {
          // TODO: Check insertResponseArray when added?
          instance._shell.lastUsedCursor = null;
          for (var i = 1; i < 3; i++) {
            batchSize = i + 1;
            instance._printBatch();
            expect(instance._shell.lastUsedCursor).toEqual(instance);
            expect(getShellBatchSizeSpy.calls.length).toBe(i);
            expect(insertResponseLineSpy.calls.length).toBe(batchSize + 1);
            insertResponseLineSpy.reset();
          }
          batchSize = instance._result.length + 1;
          instance._printBatch();
          var oldInsertCalls = insertResponseLineSpy.calls.length;
          instance._printBatch();
          expect(insertResponseLineSpy.calls.length).toBe(oldInsertCalls);
        });

        it('returns a boolean showing if it has another result', function () {
          var actual = instance.hasNext();
          expect(instance._executeQuery.calls.length).toBe(1);
          expect(actual).toBe(true);
          instance._result = [];
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
          expect(instance.next.bind(instance)).toThrow('Cursor does not have any more elements.');
          // Should throw error, not print anything.
          expect(insertResponseLineSpy.calls.length).toBe(oldCallCount);
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

  it('converts query results to an array', function () {
    var results = [{a: 1}, {b: 2}, {c: 3}];
    result.result = results.slice(0);

    var array = instance.toArray();
    expect(array).toEqual(results);

    // Converting to array should consume the cursor
    instance._printBatch();
    expect(insertResponseLineSpy).not.toHaveBeenCalled();

    // To fit the shell's behavior, make sure we're not copying the array
    array[0] = {foo: 'bar'};
    expect(instance.toArray()).toEqual([{foo: 'bar'}, {b: 2}, {c: 3}]);

    // Only uses what's left of the cursor
    result.result = results.slice(0);
    instance = new mongo.Cursor(coll);
    expect(instance.next()).toEqual({a: 1});
    expect(instance.toArray()).toEqual([{b: 2}, {c: 3}]);
  });

  it('acts as an array', function () {
    var results = [{a: 1}, {b: 2}, {c: 3}];
    result.result = results.slice();
    $.each(results, function (i, expected) {
      // This only works with the method missing functionality
      expect(mongo.util.__get(instance, i)).toEqual(expected);
    });
  });

  describe('counting results', function () {
    it('doesn\'t execute the query', function () {
      instance.count();
      expect(instance._executed).toBe(false);
    });

    it('gets the count from the server', function () {
      var query = {a: {$gt: 2}};
      var projection = {_id: 0, b: 1};
      coll.urlBase = 'my_coll_url/';
      instance = new mongo.Cursor(coll, query, projection);
      result = {count: 12};

      expect(instance.count()).toEqual(12);
      expect(makeRequest.calls.length).toEqual(1);
      var args = makeRequest.calls[0].args;
      expect(args[0]).toEqual('my_coll_url/count'); // Url
      expect(args[1]).toEqual({query: query}); // params
      expect(args[2]).toEqual('GET'); // GET request
      expect(args[4]).toEqual(coll.shell); // Use the collection's shell
      expect(args[6]).toEqual(false); // Synchronous
    });

    it('ignores skip and limit by default', function () {
      instance.skip(3).limit(7);
      instance.count();
      var params = makeRequest.mostRecentCall.args[1];
      expect(params.skip).toBeUndefined();
      expect(params.limit).toBeUndefined();
    });

    it('can incorporate skip and limit', function () {
      instance.skip(3).limit(7);
      instance.count(false);
      var params = makeRequest.mostRecentCall.args[1];
      expect(params.skip).toBeUndefined();
      expect(params.limit).toBeUndefined();

      instance.count(true);
      params = makeRequest.mostRecentCall.args[1];
      expect(params.skip).toEqual(3);
      expect(params.limit).toEqual(7);
    });

    it('uses size as an alias for count', function () {
      var value = 14;
      spyOn(instance, 'count').andReturn(value);
      expect(instance.size()).toEqual(value);
      expect(instance.count).toHaveBeenCalledWith(true);
    });
  });
});
