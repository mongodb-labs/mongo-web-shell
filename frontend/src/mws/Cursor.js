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

/* global console, mongo, Error */
/**
 * A wrapper over the result set of a query, that users can iterate through to
 * retrieve results. Before the query is executed, users may modify the query
 * result set format through various methods such as sort().
 *
 * The cursor calls queryFunction and expects that the onSuccess method it
 * passes to the query function will be called with the relevant data upon
 * successful execution of the actual query. It also expects that all actions
 * performed will honor the async flag, as sometimes (such as when evaluating
 * a series of statements) we expect results to be returned in a synchronous
 * order.
 */
mongo.Cursor = function (collection, query, projection) {
  this._coll = collection;
  this._shell = collection.shell;
  this._query = query || null;
  this._fields = projection || null;
  this._executed = false;
  this._result = [];
  console.debug('Created mongo.Cursor:', this);
};

/**
 * Executes the stored query function, disabling result set format modification
 * methods such as sort() and enabling result set iteration methods such as
 * next(). Will execute onSuccess on query success, or instantly if the query
 * was previously successful. onSuccess will be called asynchronously by
 * default, or synchronously if given false for the async parameter.
 */
mongo.Cursor.prototype._executeQuery = function (onSuccess, async) {
  async = typeof async !== 'undefined' ? async : true;
  if (!this._executed) {
    console.debug('Executing query:', this);

    var url = this._coll.urlBase + 'find';
    var params = {};
    if (this._query) { params.query = this._query; }
    if (this._fields) { params.projection = this._fields; }
    if (this._skip) { params.skip = this._skip; }
    if (this._limit) { params.limit = this._limit; }
    var wrappedSuccess = function (data) {
      this._storeQueryResult(data.result);
      if (onSuccess) {
        onSuccess();
      }
    }.bind(this);

    mongo.request.makeRequest(url, params, 'GET', 'dbCollectionFind', this._shell,
                              wrappedSuccess, async);
    this._executed = true;
  } else if (onSuccess) {
    onSuccess();
  }
};

mongo.Cursor.prototype._printBatch = function () {
  this._shell.lastUsedCursor = this;
  var context = this._shell.evaluator.pause();
  var batchSize = this._shell.getShellBatchSize();
  var n = 0;
  var doPrint = function () {
    this.hasNext(function (hasNext) {
      if (hasNext) {
        if (n < batchSize) {
          this.next(function (next) {
            this._shell.insertResponseLine(next);
            n++;
            doPrint();
          }.bind(this));
        } else {
          this._shell.insertResponseLine('Type "it" for more');
          this._shell.evaluator.resume(context);
        }
      } else {
        this._shell.lastUsedCursor = null;
        this._shell.evaluator.resume(context);
      }
    }.bind(this));
  }.bind(this);
  doPrint();
};

mongo.Cursor.prototype._storeQueryResult = function (result) {
  // For efficiency, we reverse the result. This allows us to pop() as we
  // iterate over the result set, both freeing the reference and preventing a
  // reindexing on each removal from the array as with unshift/splice().

  // We add this on after any previously received results in preparation for
  // receiving results in batches.
  this._result = result.reverse().concat(this._result);
};

/**
 * If a query has been executed from this cursor, prints an error message and
 * returns true. Otherwise returns false.
 */
mongo.Cursor.prototype._warnIfExecuted = function (methodName) {
  if (this._executed) {
    this._shell.insertResponseLine('Warning: Cannot call ' + methodName +
        ' on already executed mongo.Cursor.' + this);
    console.warn('Cannot call', methodName, 'on already executed ' +
        'mongo.Cursor.', this);
  }
  return this._executed;
};

/**
 * If a query has been executed from this cursor, throw an Error. Otherwise
 * returns false.
 */
mongo.Cursor.prototype._ensureNotExecuted = function (methodName) {
  if (this._executed) {
    throw new Error('Cannot ' + methodName + ' results after query has been executed.');
  }
};

mongo.Cursor.prototype.hasNext = function (callback) {
  var context = this._shell.evaluator.pause();
  this._executeQuery(function () {
    var hasNext = this._result.length > 0;
    this._shell.evaluator.resume(context, hasNext);
    if (callback) {
      callback(hasNext);
    }
  }.bind(this));
};

mongo.Cursor.prototype.next = function (callback) {
  var context = this._shell.evaluator.pause();
  this._executeQuery(function () {
    var next, isError;
    if (this._result.length === 0) {
      next = new Error('Cursor does not have any more elements.');
      isError = true;
    } else {
      next = this._result.pop();
      isError = false;
    }
    this._shell.evaluator.resume(context, next, isError);
    if (callback && !isError) {
      callback(next);
    }
  }.bind(this));
};

mongo.Cursor.prototype.sort = function (sort) {
  if (this._warnIfExecuted('sort')) { return this; }
  // TODO: Implement.
  console.debug('mongo.Cursor would be sorted with', sort, this);
  return this;
};

mongo.Cursor.prototype.skip = function (skip) {
  this._ensureNotExecuted('skip');
  if (!mongo.util.isInteger(skip)) {
    throw new Error('Skip amount must be an integer.');
  }
  this._skip = skip;
  return this;
};

mongo.Cursor.prototype.limit = function (limit) {
  this._ensureNotExecuted('limit');
  if (!mongo.util.isInteger(limit)) {
    throw new Error('Limit amount must be an integer.');
  }
  this._limit = limit;
  return this;
};

mongo.Cursor.prototype.toArray = function (callback) {
  var context = this._shell.evaluator.pause();
  if (this._arr) {
    this._shell.evaluator.resume(context, this._arr);
    if (callback) {
      callback(this._arr);
    }
    return;
  }

  this._executeQuery(function () {
    // This is the wrong way to do this. We really should be calling next as
    // long as hasNext returns true, but those need to take callbacks since
    // they in theory can perform a network request at any time. However, this
    // very quickly exceeds the maximum recursion limit for large arrays. This
    // breaks the abstraction barrier and looks into how the results are stored.
    // It also assumes that this is a dumb cursor that gets all possible results
    // in a single request.

    // Results are stored in reverse order
    this._arr = this._result.reverse();
    this._result = [];
    this._shell.evaluator.resume(context, this._arr);
    if (callback) {
      callback(this._arr);
    }
  }.bind(this));
};

mongo.Cursor.prototype.count = function (useSkipLimit) {
  useSkipLimit = !!useSkipLimit; // Default false
  var url = this._coll.urlBase + 'count';
  var params = {};
  if (this._query) { params.query = this._query; }
  if (useSkipLimit) {
    if (this._skip) { params.skip = this._skip; }
    if (this._limit) { params.limit = this._limit; }
  }
  var context = this._shell.evaluator.pause();
  var setCount = function (data) {
    this._shell.evaluator.resume(context, data.count);
  }.bind(this);
  mongo.request.makeRequest(url, params, 'GET', 'Cursor.count', this._shell, setCount);
};

mongo.Cursor.prototype.size = function () {
  return this.count(true);
};

mongo.Cursor.prototype.toString = function () {
  var query = this._query || {};
  return 'Cursor: ' + this._coll.toString() + ' -> ' + mongo.jsonUtils.tojson(query);
};

mongo.Cursor.prototype.__methodMissing = function (field) {
  if (mongo.util.isInteger(field)) {
    var context = this._shell.evaluator.pause();
    this.toArray(function (arr) {
      this._shell.evaluator.resume(context, arr[field]);
    }.bind(this));
  }
};