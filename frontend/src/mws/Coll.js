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


/**
 * Prepare a cursor iterator that implements next() in a way the shell can
 * utilize.
 */
mongo.Coll.prototype.find = function (query, projection) {
  var url = this.urlBase + 'find';
  var shell = this.shell;
  query = query || null;
  projection = projection || null;
  var cursor;

  mongo.events.functionTrigger(this.shell, 'db.collection.find', arguments,
                               {collection: this.name});
  params = {
    query: query,
    projection: projection
  };

  function findRequest(onSuccess, extraParams){
    $.extend(params, extraParams);
    mongo.request.makeRequest(url, params, 'GET', 'dbCollectionFind', shell,
      onSuccess);
  }

  cursor = new mongo.Cursor(this, findRequest);
  return cursor;
};

mongo.Coll.prototype.findOne = function (query, projection) {
  var self = this;
  var url = this.urlBase + 'find_one';
  var shell = this.shell;
  query = query || null;
  projection = projection || null;
  var params = {
    query: query,
    projection: projection
  };


  mongo.events.functionTrigger(this.shell, 'db.collection.findOne', arguments,
                               {collection: this.name});
  var context = shell.evaluator.pause();
  mongo.request.makeRequest(url, params, 'GET', 'dbCollectionFindOne', shell,
        function(data){
            shell.evaluator.resume(context, data);
        });
};

mongo.Coll.prototype.count = function (query) {
  var self = this;
  var url = this.urlBase + 'count';
  var shell = this.shell;
  query = query || null;
  var params = {query: query};
  mongo.events.functionTrigger(shell, 'db.collection.count', arguments,
                               {collection: this.name});
  var context = shell.evaluator.pause();
  mongo.request.makeRequest(url, params,'GET', 'dbCollectionCount', shell,
      function(data){
        shell.evaluator.resume(context, data);
      });
};

mongo.Coll.prototype.insert = function (doc) {
  var url = this.urlBase + 'insert';
  var params = {document: doc};
  var shell = this.shell;
  mongo.events.functionTrigger(this.shell, 'db.collection.insert', arguments,
                               {collection: this.name});
  var context = shell.evaluator.pause();
  tst = mongo.request.makeRequest(url, params, 'POST', 'dbCollectionInsert', shell,
    function(data){
        shell.evaluator.resume(context, data['pretty']);
    });
};

mongo.Coll.prototype.save = function (doc) {
  var url = this.urlBase + 'save';
  var params = {document: doc};
  var shell = this.shell;
  mongo.events.functionTrigger(this.shell, 'db.collection.save', arguments,
    {collection: this.name});
  var context = shell.evaluator.pause();
  mongo.request.makeRequest(url, params, 'POST', 'dbCollectionSave', shell,
    function(data){
        shell.evaluator.resume(context, data['pretty']);
    });
};

/**
 * Makes a remove request to the mongod instance on the backing server. On
 * success, the item(s) are removed from the collection, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.remove = function (constraint, options) {
  var shell = this.shell;
  if (typeof(options) !== "object"){
    var justOne = options
    options = {'justOne': !!justOne}
  }
  if (!constraint) {
    shell.insertError("remove needs a query");
    return;
  }
  var url = this.urlBase + 'remove';
  var params = {constraint: constraint, options: options};
  mongo.events.functionTrigger(this.shell, 'db.collection.remove', arguments,
                               {collection: this.name});
  var context = shell.evaluator.pause();
  mongo.request.makeRequest(url, params, 'DELETE', 'dbCollectionRemove', shell,
    function(data){
        shell.evaluator.resume(context, data['pretty']);
    });
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
  var shell = this.shell;
  mongo.events.functionTrigger(this.shell, 'db.collection.update', arguments,
                               {collection: this.name});

  // handle options document for 2.2+
  if (typeof upsert === 'object'){
    if (multi !== undefined){
      var msg = 'Fourth argument must be empty when specifying upsert and multi with an object';
      this.shell.insertError(msg);
      throw {message: 'dbCollectionUpdate: Syntax error'};
    }
    multi = upsert.multi;
    upsert = upsert.upsert;
  }

  var params = {query: query, update: update, upsert: !!upsert, multi: !!multi};
  var context = shell.evaluator.pause();
  mongo.request.makeRequest(url, params, 'PUT', 'dbCollectionUpdate', shell,
    function(data){
        shell.evaluator.resume(context, data['pretty']);
    });
};

/**
 * Makes a drop request to the mongod instance on the backing server. On
 * success, the collection is dropped from the database, otherwise a failure
 * message is printed and an error is thrown.
 */
mongo.Coll.prototype.drop = function () {
  var url = this.urlBase + 'drop';
  var shell = this.shell;
  mongo.events.functionTrigger(this.shell, 'db.collection.drop', arguments,
                               {collection: this.name});
  var context = shell.evaluator.pause();
  mongo.request.makeRequest(url, null, 'DELETE', 'dbCollectionDrop', shell,
    function(){
        shell.evaluator.resume(context, true);
    });
};

/**
 * Makes an aggregation request to the mongod instance on the backing server.
 * A cursor object is created, and returned to the shell.
 */
mongo.Coll.prototype.aggregate = function() {
  var shell = this.shell;
  var query;
  if (arguments.length === 1 && $.isArray(arguments[0])) {
    query = arguments[0];
  } else {
    query = $.makeArray(arguments);
  }
  var url = this.urlBase + 'aggregate';
  mongo.events.functionTrigger(this.shell, 'db.collection.aggregate',
                               arguments, {collection: this.name});
  function aggregateRequest(onSuccess){
    mongo.request.makeRequest(url, query, 'GET', 'dbCollectionAggregate', shell, onSuccess);
  }

  cursor = new mongo.Cursor(this, aggregateRequest);
  return cursor;
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
