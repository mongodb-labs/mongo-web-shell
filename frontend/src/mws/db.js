/* global mongo */
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

mongo.DB.prototype.it = function () {
  var cursor = this.shell.lastUsedCursor;
  if (cursor && cursor.hasNext()) {
    cursor._printBatch();
    return;
  }
  this.shell.insertResponseLine('no cursor');
  console.warn('no cursor');
};

mongo.DB.prototype.help = function (arg, arg2) {
  // TODO: Implement.
  console.debug('keyword.help called.');
};

mongo.DB.prototype.show = function (arg) {
  // TODO: Implement.
  console.debug('keyword.show called.');
};

mongo.DB.prototype.use = function () {
  this.shell.insertResponseLine('Cannot change db: functionality disabled.');
  console.debug('cannot change db: functionality disabled.');
};