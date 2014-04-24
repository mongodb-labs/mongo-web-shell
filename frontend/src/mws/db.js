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

mongo.DB.prototype.listCollections = function () {
  mongo.keyword.show(this.shell, ['collections']);
};

mongo.DB.prototype.getName = function() {
  return this.name;
};

mongo.DB.prototype.__methodMissing = function (field) {
  var unsupported = {
    'addUser': 0,
    'adminCommand': 0,
    'auth': 0,
    'cloneDatabase': 0,
    'commandHelp': 0,
    'copyDatabase': 0,
    'createCollection': 0,
    'currentOp': 0,
    'dropDatabase': 0,
    'eval': 0,
    'fsyncLock': 0,
    'fsyncUnlock': 0,
    'getCollection': 0,
    'getLastError': 0,
    'getLastErrorObj': 0,
    'getMongo': 0,
    'getPrevError': 0,
    'getProfilingLevel': 0,
    'getProfilingStatus': 0,
    'getReplicationInfo': 0,
    'getSiblingDB': 0,
    'hostInfo': 0,
    'isMaster': 0,
    'killOp': 0,
    'listCommands': 0,
    'loadServerScripts': 0,
    'logout': 0,
    'printCollectionStats': 0,
    'printReplicationInfo': 0,
    'printShardingStatus': 0,
    'printSlaveReplicationInfo': 0,
    'removeUser': 0,
    'repairDatabase': 0,
    'resetError': 0,
    'runCommand': 0,
    'serverStatus': 0,
    'setProfilingLevel': 0,
    'setVerboseShell': 0,
    'shutdownServer': 0,
    'stats': 0,
    'version': 0
  };

  if (unsupported.hasOwnProperty(field)) {
    this.shell.insertError('The web shell does not support db.'+ field + '()');
    return mongo.util.noOp;
  } else {
    this[field] = new mongo.Coll(this, field);
    return this[field];
  }
};

mongo.DB.prototype.getCollectionNames = function (callback) {
  var url = mongo.util.getDBResURL(this.shell.mwsResourceID) + 'getCollectionNames';
  mongo.request.makeRequest(url, undefined, 'GET', 'getCollectionNames', this.shell, callback);
};