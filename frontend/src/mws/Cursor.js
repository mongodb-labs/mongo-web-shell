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
      mongo.events.callbackTrigger(this._shell, 'db.collection.find.callback', data.result);
    }.bind(this);

    mongo.request.makeRequest(url, params, 'GET', 'dbCollectionFind', this._shell,
                              wrappedSuccess, async);
    this._executed = true;
  } else if (onSuccess) {
    onSuccess();
  }
};

mongo.Cursor.prototype._printBatch = function () {
  this._executeQuery(function () {
    this._shell.lastUsedCursor = this;
    var batchSize = this._shell.getShellBatchSize();
    var n = 0;
    while (this.hasNext() && n < batchSize){
      this._shell.insertResponseLine(this.next());
      n++;
    }

    if (this.hasNext()) {
      this._shell.insertResponseLine('Type "it" for more');
    }
  }.bind(this));
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
  this._executeQuery(null, false); // Sync query, blocks
  return this._result.length > 0;
};

mongo.Cursor.prototype.next = function () {
  this._executeQuery(null, false); // Sync query, blocks
  if (!this.hasNext()) {
    throw new Error('Cursor does not have any more elements.');
  }
  return this._result.pop();
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

mongo.Cursor.prototype.toArray = function () {
  if (this._arr) {
    return this._arr;
  }
  var a = [];
  while (this.hasNext()) {
    a.push(this.next());
  }
  this._arr = a;
  return a;
};

mongo.Cursor.prototype.count = function (useSkipLimit) {
  useSkipLimit = !!useSkipLimit; // Default false
  var count = 0;
  var url = this._coll.urlBase + 'count';
  var params = {};
  if (this._query) { params.query = this._query; }
  if (useSkipLimit) {
    if (this._skip) { params.skip = this._skip; }
    if (this._limit) { params.limit = this._limit; }
  }
  var updateCount = function (data) {
    count = data.count;
  };
  mongo.request.makeRequest(url, params, 'GET', 'Cursor.count', this._shell,
                            updateCount, false); // Sync request, blocking
  return count;
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
    return this.toArray()[field];
  }
  return undefined;
};
