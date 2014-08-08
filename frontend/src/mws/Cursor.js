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
mongo.Cursor = function (collection, query) {
  this._coll = collection;
  this._shell = collection.shell;
  this.urlBase = mongo.util.getDBCollectionResURL(this._shell.mwsResourceID, collection.name);
  this._query = query;
  this._executed = false;
  this._result = [];
  this._retrieved = 0;
  this._count = 0;
  this._batchSize = collection.shell.getShellBatchSize();
};


/**
 * Execute either the passed in function, or the getMore function, calling the
 * success callback in either case.
 */
mongo.Cursor.prototype._executeQuery = function (onSuccess) {
  var wrappedSuccess = function (data) {
    if (data) {
        mongo.events.callbackTrigger(this._shell, 'cursor.execute', data.result.slice());
        this._storeQueryResult(data.result);
        this._cursorId = data.cursor_id || this._cursorId;
        this._count = data.count || this._count;
        this._retrieved += data.result.length;
        this._hasNext = this._retrieved < this._count;
    }
    if (onSuccess) {
      onSuccess();
    }
  }.bind(this);

  if (!this._executed) {
    var extraParams = {};
    extraParams['sort'] = this._sort;
    extraParams['limit'] = this._limit;
    extraParams['skip'] = this._skip;
    this._query(wrappedSuccess, extraParams);
    this._executed = true;
  } else {
    this._getMore(wrappedSuccess);
  }
};


mongo.Cursor.prototype._getMore = function (callback) {
  if ((!this._executed || this._retrieved < this._count) &&
      (this._result.length === 0)) {
    var url = this.urlBase + "next";
    var params = {};
    params['cursor_id'] = this._cursorId;
    params['retrieved'] = this._retrieved;
    mongo.request.makeRequest(url, params, 'GET', 'CursorGetMore', this._shell,
      callback);
  } else if (callback) {
    callback();
  }
}


mongo.Cursor.prototype._printBatch = function () {
  var self = this;

  function printBatch() {
    self._shell.lastUsedCursor = self;
    var n = 0;
    function recursiveFetchLoop(){
        self.next(function(next){
          self._shell.insertResponseLine(next);
          n++;
          if (n < self._batchSize) {
            if (self.hasNext()) {
                recursiveFetchLoop();
            }
          } else {
            self._shell.insertResponseLine('Type "it" for more');
          }
        });
    }
    recursiveFetchLoop();
  }
  if (!this._executed){
    var context = this._shell.evaluator.pause();
    this._executeQuery(function(){
        printBatch()
        self._shell.evaluator.resume(context);
        });
  } else {
    printBatch();
  }
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


mongo.Cursor.prototype.hasNext = function () {
  return (this._result.length > 0 || this._hasNext);
};


mongo.Cursor.prototype.next = function (callback) {
  if (this._result.length > 0) {
    callback(this._result.pop());
    return;
  }
  var context = this._shell.evaluator.pause();
  this._executeQuery(function () {
    var next, isError;
    if (this._result.length === 0) {
      next = new Error('Cursor does not have any more elements.');
      isError = true;
      this._shell.lastUsedCursor = null;
      /*
        If count is a multiple of batchsize, send another executeQuery
        to clean up a lingering cursor
      */
      if(this._count % this._batchSize === 0){
        this._executeQuery();
      }
    } else {
      next = this._result.pop();
      isError = false;
    }
    if (callback && !isError) {
      callback(next);
    }
    this._shell.evaluator.resume(context, next, isError);
  }.bind(this));
};


mongo.Cursor.prototype.sort = function (sort) {
  this._ensureNotExecuted('sort');
  if (!$.isPlainObject(sort)){
    throw new Error('Sort must be an object');
  }
  this._sort = sort;
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


mongo.Cursor.prototype.batchSize = function () {
  throw new Error('batchSize() is disallowed in the web shell');
};


mongo.Cursor.prototype.toArray = function (callback) {
    var result = [];
    while(this.hasNext()){
        result.push(this.next());
    }
    return result;
};


mongo.Cursor.prototype.count = function (useSkipLimit) {
  useSkipLimit = !!useSkipLimit;
  // If the cursor already has a count, use that.
  if (this._count) { return this._count; }

  // Otherwise, execute the cursor, and get the count.
  var context = this._shell.evaluator.pause();
  this._executeQuery(function () {
    this._shell.evaluator.resume(context, this._count, false);
  }.bind(this));
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
