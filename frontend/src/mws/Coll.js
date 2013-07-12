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
  mongo.events.functionTrigger(this.shell, 'db:collection:find', arguments,
                               {collection: this.name});
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
  mongo.events.functionTrigger(this.shell, 'db:collection:insert', arguments,
                               {collection: this.name});
  mongo.request.makeRequest(url, params, 'POST', 'dbCollectionInsert', this.shell);
};

/**
 * Makes a remove request to the mongod instance on the backing server. On
 * success, the item(s) are removed from the collection, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.remove = function (constraint, justOne) {
  var url = this.urlBase + 'remove';
  var params = {constraint: constraint, just_one: justOne};
  mongo.events.functionTrigger(this.shell, 'db:collection:remove', arguments,
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
 */
mongo.Coll.prototype.update = function (query, update, upsert, multi) {
  var url = this.urlBase + 'update';
  mongo.events.functionTrigger(this.shell, 'db:collection:update', arguments,
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
 */
mongo.Coll.prototype.drop = function () {
  var url = this.urlBase + 'drop';
  mongo.events.functionTrigger(this.shell, 'db:collection:drop', arguments,
                               {collection: this.name});
  mongo.request.makeRequest(url, null, 'DELETE', 'dbCollectionDrop', this.shell);
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

  mongo.events.functionTrigger(this.shell, 'db:collection:aggregate', arguments,
                               {collection: this.name});
  mongo.request.makeRequest(url, query, 'GET', 'dbCollectionAggregate', this.shell,
                            onSuccess, false); // Sync request, blocking
  return results;
};

/**
 * Makes a request to create the specified index to the mongod instance on
 * the backing server.  On success, the index is created, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.ensureIndex = function(keys, options){
  var url = this.urlBase + 'ensureIndex';
  var data = {keys: keys, options: options};
  mongo.request.makeRequest(url, data, 'POST', 'dbCollectionEnsureIndex', this.shell);
};

/**
 * Makes a request to reindex all indexes of the collection to the mongod instance on
 * the backing server.  On success, the collection is reindexed, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.reIndex = function(){
  var url = this.urlBase + 'reIndex';
  mongo.request.makeRequest(url, null, 'PUT', 'dbCollectionReIndex', this.shell);
};

/**
 * Makes a request to drop the specified index to the mongod instance on
 * the backing server.  On success, the index is dropped, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.dropIndex = function(name){
  var url = this.urlBase + 'dropIndex';
  var data = {name: name};
  mongo.request.makeRequest(url, data, 'DELETE', 'dbCollectionDropIndex', this.shell);
};

/**
 * Makes a request to drop all indexes of the collection to the mongod instance on
 * the backing server.  On success, all indexes are dropped, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.dropIndexes = function(){
  var url = this.urlBase + 'dropIndexes';
  mongo.request.makeRequest(url, null, 'DELETE', 'dbCollectionDropIndexes', this.shell);
};

/**
 * Makes a request to get the indexes of the collection to the mongod instance on
 * the backing server.  On success, index information is returned, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.getIndexes = function(){
  var results = [];
  var url = this.urlBase + 'getIndexes';
  var onSuccess = function(data){
    results = data;
  }.bind(this);
  mongo.request.makeRequest(url, null, 'GET', 'dbCollectionGetIndexes', this.shell, onSuccess,
                            false);
  return results;
};
