/* global console, mongo */
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
mongo.Cursor = function (shell, queryFunction) {
  this._shell = shell;
  this._query = {
    wasExecuted: false,
    func: queryFunction,
    result: null
  };
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
  if (!this._query.wasExecuted) {
    console.debug('Executing query:', this);
    this._query.func(function (result) {
      this._storeQueryResult(result);
      if (onSuccess) {
        onSuccess(result);
      }
    }.bind(this), async);
    this._query.wasExecuted = true;
  } else {
    onSuccess();
  }
};

mongo.Cursor.prototype._printBatch = function () {
  var cursor = this;
  this._executeQuery(function () {
    cursor._shell.lastUsedCursor = cursor;

    var setSize = cursor._shell.getShellBatchSize();
    var batch = [];
    for (var i = 0; i < setSize; i++) {
      // pop() setSize times rather than splice(-setSize) to preserve order.
      var doc = cursor._query.result.pop();
      if (doc === undefined) {
        break;
      }
      batch.push(doc);
    }

    if (batch.length !== 0) {
      // TODO: Use insertResponseArray instead, stringify in insertResponseLine
      for (i = 0; i < batch.length; i++) {
        cursor._shell.insertResponseLine(JSON.stringify(batch[i]));
      }
      console.debug('_printBatch() results:', batch);
    }
    if (cursor.hasNext()) {
      cursor._shell.insertResponseLine('Type "it" for more');
      console.debug('Type "it" for more');
    }
  });
};

mongo.Cursor.prototype._storeQueryResult = function (result) {
  // For efficiency, we reverse the result. This allows us to pop() as we
  // iterate over the result set, both freeing the reference and preventing a
  // reindexing on each removal from the array as with unshift/splice().
  this._query.result = result.reverse();
};

/**
 * If a query has been executed from this cursor, prints an error message and
 * returns true. Otherwise returns false.
 */
mongo.Cursor.prototype._warnIfExecuted = function (methodName) {
  if (this._query.wasExecuted) {
    this._shell.insertResponseLine('Warning: Cannot call ' + methodName +
        ' on already executed mongo.Cursor.' + this);
    console.warn('Cannot call', methodName, 'on already executed ' +
        'mongo.Cursor.', this);
  }
  return this._query.wasExecuted;
};

mongo.Cursor.prototype.hasNext = function () {
  var hasNext, cursor = this;
  this._executeQuery(function () {
    hasNext = cursor._query.result.length === 0 ? false : true;
  }, false);
  return hasNext;
};

mongo.Cursor.prototype.next = function () {
  var nextVal, cursor = this;
  this._executeQuery(function () {
    nextVal = cursor._query.result.pop();
  }, false);
  if (nextVal !== undefined) {
    return nextVal;
  }
  cursor._shell.insertResponseLine('ERROR: no more results to show');
  console.warn('Cursor error hasNext: false', this);
};

mongo.Cursor.prototype.sort = function (sort) {
  if (this._warnIfExecuted('sort')) { return this; }
  // TODO: Implement.
  console.debug('mongo.Cursor would be sorted with', sort, this);
  return this;
};
