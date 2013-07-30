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
 */
mongo.Coll.prototype.find = function (query, projection) {
  return new mongo.Cursor(this, query, projection);
};

mongo.Coll.prototype.findOne = function (query, projection) {
  var cursor = this.find(query, projection).limit(1);
  if (cursor.hasNext()) {
    return cursor.next();
  } else {
    return null;
  }
};

mongo.Coll.prototype.insert = function (doc) {
  var url = this.urlBase + 'insert';
  var params = {document: doc};
  mongo.request.makeRequest(url, params, 'POST', 'dbCollectionInsert', true);
};

/**
 * Makes a remove request to the mongod instance on the backing server. On
 * success, the item(s) are removed from the collection, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.remove = function (constraint, justOne) {
  var url = this.urlBase + 'remove';
  var params = {constraint: constraint, just_one: justOne};
  mongo.request.makeRequest(url, params, 'DELETE', 'dbCollectionRemove', true);
};

/**
 * Makes an update request to the mongod instance on the backing server. On
 * success, the item(s) are updated in the collection, otherwise a failure
 * message is printed and an error is thrown.
 *
 * Optionally, an object which specifies whether to perform an upsert and/or
 * a multiple update may be used instead of the individual upsert and multi
 * parameters.
 */
mongo.Coll.prototype.update = function (query, update, upsert, multi) {
  var url = this.urlBase + 'update';
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
  mongo.request.makeRequest(url, params, 'PUT', 'dbCollectionUpdate', true);
};

/**
 * Makes a drop request to the mongod instance on the backing server. On
 * success, the collection is dropped from the database, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.drop = function () {
  var url = this.urlBase + 'drop';
  mongo.request.makeRequest(url, null, 'DELETE', 'dbCollectionDrop', true);
};

/**
 * Makes an aggregation request to the mongod instance on the backing server.
 * On success, the result of the aggregation is returned, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.aggregate = function(query){
  query = query || [];
  var results = {};
  var url = this.urlBase + 'aggregate';
  var onSuccess = function(data){
    results = data;
  }.bind(this);
  mongo.request.makeRequest(url, query, 'GET', 'dbCollectionAggregate', true,
                            onSuccess, false); // Sync request, blocking
  return results;
};
