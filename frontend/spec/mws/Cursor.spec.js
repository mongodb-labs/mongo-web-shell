/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, spyOn */
describe('A Cursor', function () {
  var instance, batchSize = 2, getShellBatchSizeSpy, insertResponseLineSpy,
      queryFuncSpy, queryArgs;

  beforeEach(function () {
    insertResponseLineSpy = jasmine.createSpy('insertResponseLine');
    getShellBatchSizeSpy = jasmine.createSpy('getShellBatchSize').andCallFake(
        function () {
      return batchSize;
    });
    var shell = {
      getShellBatchSize: getShellBatchSizeSpy,
      insertResponseLine: insertResponseLineSpy,
      lastUsedCursor: null
    };
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
    instance = new mongo.Cursor(shell, queryFuncSpy);
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
        expect(queryFuncSpy.calls[0].args[1]).toEqual(async);
      });

      it('executes synchronous queries', function () {
        var async = false;
        instance._executeQuery(callbackSpy, async);
        expect(instance._query.wasExecuted).toBe(true);
        expect(queryFuncSpy.calls[0].args[1]).toEqual(async);
      });

      it('executes default asynchronous queries', function () {
        instance._executeQuery(callbackSpy);
        expect(instance._query.wasExecuted).toBe(true);
        expect(queryFuncSpy.calls[0].args[1]).toEqual(true);
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
