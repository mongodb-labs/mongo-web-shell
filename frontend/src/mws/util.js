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

/* global mongo */
var console; // See mongo.util.enableConsoleProtection().
mongo.util = (function () {
  /**
   * Enables protection from undefined console references on older browsers
   * without consoles.
   */
  function enableConsoleProtection() {
    if (!console || !console.log) { console = { log: function () {} }; }
    if (!console.debug || !console.error || !console.info || !console.warn) {
      var log = console.log;
      console.debug = console.error = console.info = console.warn = log;
    }
  }

  function isNumeric(val) {
    return typeof val === 'number' && !isNaN(val);
  }

  function isInteger(obj) {
    return typeof(obj) === 'number' && obj % 1 === 0;
  }

  function getDBCollectionResURL(resID, collection) {
    return getDBResURL(resID) + collection + '/';
  }

  function getDBResURL(resID) {
    return mongo.config.baseUrl + resID + '/db/';
  }

  function toString(expr){
    if (typeof(expr) === 'string') {
      return expr;
    }

    try {
      return mongo.jsonUtils.tojson(expr);
    } catch (e) {
      return 'ERROR: ' + e.message;
    }
  }

  /**
   * Helper inserted into the sandbox namespace that performs membership reads
   * to allow for the '__methodMissing' functionality
   */
  function objectMemberGetter(obj, field) {
    if (field in obj || !('__methodMissing' in obj)) {
      var rtn = obj[field];
      if (typeof(rtn) === 'function') {
        rtn = rtn.bind(obj);
      }
      return rtn;
    }
    return obj.__methodMissing(field);
  }

  return {
    enableConsoleProtection: enableConsoleProtection,
    isNumeric: isNumeric,
    isInteger: isInteger,
    getDBCollectionResURL: getDBCollectionResURL,
    getDBResURL: getDBResURL,
    toString: toString,
    __get: objectMemberGetter
  };
}());
