/* global console, mongo */
/**
 * Handles a query of the form "db.collection.method()." Some methods on this
 * object will execute the query immediately while others will return an
 * mongo.Cursor instance which is expected to continue the query lifespan.
 */
mongo.Query = function (shell, collection) {
  this.shell = shell;
  this.collection = collection;
  console.debug('Create mongo.Query', this);
};

mongo.Query.prototype.find = function (query, projection) {
  var args = {query: query, projection: projection};
  return new mongo.Cursor(this, mongo.request.dbCollectionFind, args);
};

mongo.Query.prototype.insert = function (doc) {
  mongo.request.dbCollectionInsert(this, doc);
};

mongo.Query.prototype.remove = function(constraint, justOne) {
	mongo.request.dbCollectionRemove(this, constraint, justOne);
};
