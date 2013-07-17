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