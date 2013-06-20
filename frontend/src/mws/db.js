/* global mongo, console */
/* jshint unused: false */
mongo.DB = function (shell, name) {
  this.name = name;
  this.shell = shell;
};

mongo.DB.prototype.toString = function () {
  return this.name;
};

mongo.DB.prototype.__methodMissing = function (field) {
  this[field] = new mongo.Coll(this, field);
  return this[field];
};

mongo.DB.prototype.getCollectionNames = function (callback) {
  var url = mongo.util.getDBResURL(this.shell.mwsResourceID) + 'getCollectionNames';
  mongo.request.makeRequest(url, undefined, 'GET', 'getCollectionNames', this.shell, callback);
};