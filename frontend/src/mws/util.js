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

  /**
   * Returns an object with the combined key-value pairs from the given
   * objects, for pairs not on the objects' prototypes. If there are indentical
   * keys, the pairs of the arguments given in an earlier position take
   * precedence over those given in later arguments.
   */
  function mergeObjects() {
    var out = {};
    for (var i = arguments.length - 1; i >= 0; i--) {
      addOwnProperties(out, arguments[i]);
    }
    return out;
  }

  function addOwnProperties(out, obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        out[key] = obj[key];
      }
    }
  }

  function getDBCollectionResURL(resID, collection) {
    return getDBResURL(resID) + collection + '/';
  }

  function getDBResURL(resID) {
    return mongo.config.baseUrl + resID + '/db/';
  }

  /**
   * Removes the given keys from the given object if they are undefined or
   * null. This can be used to make requests with optional args more compact.
   */
  function pruneKeys(obj, keys) {
    keys.forEach(function (key) {
      var val = obj[key];
      if (val === undefined || val === null) {
        delete obj[key];
      }
    });
  }

  function stringifyKeys(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        obj[key] = JSON.stringify(obj[key]);
      }
    }
  }

  function hasDefinedProperty(obj, prop) {
    if (Object.getPrototypeOf(obj) === null) {
      return false;
    } else if (obj.hasOwnProperty(prop)) {
      return true;
    } else {
      return hasDefinedProperty(Object.getPrototypeOf(obj), prop);
    }
  }

  function toString(expr){
    if (expr !== null && typeof(expr) === 'object' && !hasDefinedProperty(expr, 'toString')) {
      try {
        return JSON.stringify(expr);
      } catch (e) {
        return 'ERROR: ' + e.message;
      }
    } else {
      return String(expr);
    }
  }

  function arrayEqual(a, b) {
    // Note that this performs a shallow comparison and does not work on nested
    // arrays or arrays with objects that are logically the same but different
    // in memory
    if (a === b) {
      return true;
    } else if (!a || !b) {
      return false;
    } else if (a.length !== b.length) {
      return false;
    }

    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }

  function stringifyQueryResult(obj) {
    if (typeof obj === 'object'){
      if (!obj){ return 'null'; }

      if ($.isArray(obj)){
        return '[' + obj.map(function(e){
          return stringifyQueryResult(e);
        }).join(',\n') + ']';
      }

      var elements = [];
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          var val = obj[key];
          var keyString = JSON.stringify(key);
          var valString;

          // Rewrite ObjectId's in a pretty format
          var isObjectId = typeof(val) === 'object' &&
              arrayEqual(Object.keys(val), ['$oid']) &&
              typeof(val.$oid) === 'string' &&
              /^[0-9a-f]{24}$/.test(val.$oid);

          // Convert the value to string accordingly
          if (isObjectId) {
            valString = 'ObjectId("' + val.$oid + '")';
          } else if (typeof(val) === 'object') {
            // Recursively find all other ObjectID's
            valString = stringifyQueryResult(val);
          } else {
            valString = JSON.stringify(val);
          }

          // Make sure _id comes first
          var kvPair = keyString + ': ' + valString;
          if (key === '_id') {
            elements.unshift(kvPair);
          } else {
            elements.push(kvPair);
          }
        }
      }
      return '{' + elements.join(', ') + '}';
    } else {
      return String(obj);
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
    mergeObjects: mergeObjects,
    getDBCollectionResURL: getDBCollectionResURL,
    getDBResURL: getDBResURL,
    pruneKeys: pruneKeys,
    stringifyKeys: stringifyKeys,
    toString: toString,
    arrayEqual: arrayEqual,
    stringifyQueryResult: stringifyQueryResult,
    __get: objectMemberGetter,

    _addOwnProperties: addOwnProperties
  };
}());
