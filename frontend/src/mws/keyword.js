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
/* global console, mongo */
mongo.keyword = (function () {
  function handleKeywords(shell, src) {
    var tokens = src.split(/\s+/).filter(function (str) {
      return str.length !== 0;
    });
    var func = tokens[0];
    var args = tokens.slice(1);
    if (mongo.keyword[func]) {
      mongo.keyword[func](shell, args);
      return true;
    }
    return false;
  }

  function it(shell) {
    var cursor = shell.lastUsedCursor;
    if (cursor && cursor.hasNext()) {
      cursor._printBatch();
      return;
    }
    shell.insertResponseLine('no cursor');
    console.warn('no cursor');
  }

  function show(shell, args) {
    if (args.length === 0) {
      shell.insertResponseLine('ERROR: show requires at least one argument');
      return;
    }
    var subject = args[0];
    switch (subject) {
    case 'tables':
      /* falls through */
    case 'collections':
      shell.db.getCollectionNames(function (r) {
        $(r.result).each(function (i, e) {
          shell.insertResponseLine(e);
        });
      });
      break;
    default:
      shell.insertResponseLine('ERROR: Not yet implemented');
    }
  }

  function use(shell) {
    console.debug('cannot change db: functionality disabled.');
    shell.insertResponseLine('Cannot change db: functionality disabled.');
  }

  function reset(shell){
    if (!mongo.keyword._resetHasBeenCalled ||
        !shell.readline.getLastCommand().match(/^reset\b/)){
      shell.insertResponseArray([
        'You will lose all of your current data.',
        'Please enter "reset" again to reset the shell.'
      ]);
      mongo.keyword._resetHasBeenCalled = true;
      return;
    }
    mongo.keyword._resetHasBeenCalled = false;
    var url = mongo.config.baseUrl + shell.mwsResourceID + '/db';
    mongo.request.makeRequest(url, null, 'DELETE', 'reset', shell, function(){
      delete mongo.init._initState[shell.mwsResourceID];
      mongo.init.runInitializationScripts(shell.mwsResourceID, function(){
        shell.insertResponseLine('Database reset successfully');
      });
    });
  }

  function help(shell){
    shell.insertResponseArray([
      '    help                           print out this help information',
      '    show                           prints information about database',
      '      show tables                  see show collections',
      '      show collections             show collections in current database',
      '    db.foo.find()                  list objects in collection foo',
      '    db.foo.find(query)             list objects in foo matching query',
      '    db.foo.update(query, update,   updates an object matching query with the given update',
      '                  upsert, multi)   if no documents match and upsert is true, update is',
      '                                   inserted if multiple documents matching query exist and',
      '                                   multi is true all matching documents are updated',
      '    db.foo.remove(query, justOne)  removes all or just one documents matching query',
      '    db.foo.drop()                  removes the foo collection from the database',
      '    it                             result of the last line evaluated; use to further ' +
                                          'iterate',
      '    reset                          resets the database to its initial state'
    ]);
  }

  return {
    handleKeywords: handleKeywords,
    _resetHasBeenCalled: false,

    it: it,
    show: show,
    use: use,
    reset: reset,
    help: help
  };
}());
