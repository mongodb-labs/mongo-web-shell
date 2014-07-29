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

/* jshint camelcase: false */
/* global mongo, console */
mongo.Coll = function (db, name) {
  if (name.length > 80){
		throw new mongo.CollectionNameError('Collection name must be 80 characters or less');
	}

	if (name.match(/(\$|\0)/)){
		throw new mongo.CollectionNameError('Collection name may not contain $ or \\0');
	}

	if (name.match(/^system\./)){
		throw new mongo.CollectionNameError('Collection name may not begin with system.*');
	}

	if (name === ''){
		throw new mongo.CollectionNameError('Collection name may not be empty');
	}

  this.name = name;
  this.db = db;
  this.shell = db.shell;
  this.urlBase = mongo.util.getDBCollectionResURL(db.shell.mwsResourceID, name);
};

mongo.Coll.prototype.toString = function () {
  return this.db.toString() + '.' + this.name;
};

// Todo: rewrite documentation in this file to reflect it's new location

/**
 * Makes a Cursor that is the result of a find request on the mongod backing
 * server.
 * @name find
 * @param {object} query
 * @param {object} projection
 * @returns {mongo.Cursor}
 */
mongo.Coll.prototype.find = function (query, projection) {
  mongo.events.functionTrigger(this.shell, 'db.collection.find', arguments,
                               {collection: this.name});
  return new mongo.Cursor(this, query, projection);
};

/**
 * Finds a single document based on the query
 * @name findOne
 * @param {object} query
 * @param {object} projection
 * @returns {object}
 */
mongo.Coll.prototype.findOne = function (query, projection) {
  mongo.events.functionTrigger(this.shell, 'db.collection.findOne', arguments,
                               {collection: this.name});
  var cursor = this.find(query, projection).limit(1);
  var context = this.shell.evaluator.pause();
  cursor.hasNext(function (hasNext) {
    if (hasNext) {
      cursor.next(function (next) {
        this.shell.evaluator.resume(context, next);
      }.bind(this));
    } else {
      this.shell.evaluator.resume(context, null);
    }
  }.bind(this));
};

/**
 * Count number of matching documents in the db to a query.
 * @name count
 * @param {object} query
 * @param {object} projection
 * @returns {number}
 */
mongo.Coll.prototype.count = function (query, projection) {
  mongo.events.functionTrigger(this.shell, 'db.collection.count', arguments,
                               {collection: this.name});
  return new mongo.Cursor(this, query, projection).count();
};

/**
 * Inserts a single document into MongoDB.
 * @name insert
 * @param {object} doc
 */
mongo.Coll.prototype.insert = function (doc) {
  var url = this.urlBase + 'insert';
  var params = {document: doc};
  mongo.events.functionTrigger(this.shell, 'db.collection.insert', arguments,
                               {collection: this.name});
  mongo.request.makeRequest(url, params, 'POST', 'dbCollectionInsert', this.shell);
};

/**
 * Save a document. Simple full document replacement function.
 * @name save
 * @param {object} doc
 */
mongo.Coll.prototype.save = function (doc) {
  var url = this.urlBase + 'save';
  var params = {document: doc};
  mongo.events.functionTrigger(this.shell, 'db.collection.save', arguments,
    {collection: this.name});
  mongo.request.makeRequest(url, params, 'POST', 'dbCollectionSave', this.shell);
};

/**
 * Makes a remove request to the mongod instance on the backing server. On
 * success, the item(s) are removed from the collection, otherwise a failure
 * message is printed and an error is thrown.
 * @name remove
 * @param {object} constraint
 * @param {boolean} justOne
 */
mongo.Coll.prototype.remove = function (constraint, justOne) {
  var url = this.urlBase + 'remove';
  var params = {constraint: constraint, just_one: justOne};
  mongo.events.functionTrigger(this.shell, 'db.collection.remove', arguments,
                               {collection: this.name});
  mongo.request.makeRequest(url, params, 'DELETE', 'dbCollectionRemove', this.shell);
};

/**
 * Makes an update request to the mongod instance on the backing server. On
 * success, the item(s) are updated in the collection, otherwise a failure
 * message is printed and an error is thrown.
 *
 * Optionally, an object which specifies whether to perform an upsert and/or
 * a multiple update may be used instead of the individual upsert and multi
 * parameters.
 *
 * @name update
 * @param {object} query
 * @param update
 * @param {object} upsert
 * @param {object} multi
 */
mongo.Coll.prototype.update = function (query, update, upsert, multi) {
  var url = this.urlBase + 'update';
  mongo.events.functionTrigger(this.shell, 'db.collection.update', arguments,
                               {collection: this.name});

  // handle options document for 2.2+
  if (typeof upsert === 'object'){
    if (multi !== undefined){
      var msg = 'Fourth argument must be empty when specifying upsert and multi with an object';
      this.shell.insertResponseLine('ERROR: ' + msg);
      console.error('dbCollectionUpdate fail: ' + msg);
      throw {message: 'dbCollectionUpdate: Syntax error'};
    }
    multi = upsert.multi;
    upsert = upsert.upsert;
  }

  var params = {query: query, update: update, upsert: !!upsert, multi: !!multi};
  mongo.request.makeRequest(url, params, 'PUT', 'dbCollectionUpdate', this.shell);
};

/**
 * Makes a drop request to the mongod instance on the backing server. On
 * success, the collection is dropped from the database, otherwise a failure
 * message is printed and an error is thrown.
 *
 * @name drop
 */
mongo.Coll.prototype.drop = function () {
  var url = this.urlBase + 'drop';
  mongo.events.functionTrigger(this.shell, 'db.collection.drop', arguments,
                               {collection: this.name});
  mongo.request.makeRequest(url, null, 'DELETE', 'dbCollectionDrop', this.shell);
};

/**
 * Makes an aggregation request to the mongod instance on the backing server.
 * On success, the result of the aggregation is returned, otherwise a failure
 * message is printed and an error is thrown.
 *
 * @name aggregate
 * @param {object} query
 */
mongo.Coll.prototype.aggregate = function() {
  var query;
  if (arguments.length === 1 && $.isArray(arguments[0])) {
    query = arguments[0];
  } else {
    query = $.makeArray(arguments);
  }
  var url = this.urlBase + 'aggregate';
  var context = this.shell.evaluator.pause();
  var onSuccess = function(data){
    this.shell.evaluator.resume(context, data);
  }.bind(this);
  mongo.events.functionTrigger(this.shell, 'db.collection.aggregate', arguments,
                               {collection: this.name});
  mongo.request.makeRequest(url, query, 'GET', 'dbCollectionAggregate', this.shell, onSuccess);
};

mongo.Coll.prototype.__methodMissing = function (field) {
  var unimplemented = {
    'createIndex': 0,
    'copyTo': 0,
    'distinct': 0,
    'dropIndex': 0,
    'dropIndexes': 0,
    'ensureIndex': 0,
    'findAndModify': 0,
    'getIndexes': 0,
    'getShardDistribution': 0,
    'getShardVersion': 0,
    'group': 0,
    'isCapped': 0,
    'mapReduce': 0,
    'reIndex': 0,
    'renameCollection': 0,
    'stats': 0,
    'storageSize': 0,
    'totalSize': 0,
    'totalIndexSize': 0,
    'validate': 0
  };
  var msg;

  if (unimplemented.hasOwnProperty(field)) {
    msg = ' is not implemented.';
  } else {
    msg = ' is not a function on collections.';
  }
  this.shell.insertError(field + msg);
  return mongo.util.noOp;
};
