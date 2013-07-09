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
