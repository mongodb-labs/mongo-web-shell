mongo.CollectionNameError = function(message) {
  this.name = "CollectionNameError";
  this.message = message || "Invalid collection name";
}
mongo.CollectionNameError.prototype = new Error();
mongo.CollectionNameError.prototype.constructor = mongo.CollectionNameError;
