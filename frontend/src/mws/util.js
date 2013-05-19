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

  /**
   * Uses the range indices in the given AST to divide the given source into
   * individual statements and returns each statement as an entry in an array.
   */
  function sourceToStatements(src, ast) {
    var statements = [];
    ast.body.forEach(function (statementNode) {
      var srcIndices = statementNode.range;
      statements.push(src.substring(srcIndices[0], srcIndices[1]));
    });
    return statements;
  }

  function getDBCollectionResURL(resID, collection) {
    return mongo.config.baseUrl + resID + '/db/' + collection + '/';
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

  return {
    enableConsoleProtection: enableConsoleProtection,
    isNumeric: isNumeric,
    mergeObjects: mergeObjects,
    sourceToStatements: sourceToStatements,
    getDBCollectionResURL: getDBCollectionResURL,
    pruneKeys: pruneKeys,
    stringifyKeys: stringifyKeys,

    _addOwnProperties: addOwnProperties
  };
}());
