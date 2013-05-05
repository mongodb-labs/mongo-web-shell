/* jshint camelcase: false, evil: true, unused: false */
/* global esprima, falafel */
var mongo = {
  config: null,
  shells: {} // {shellID: mongo.Shell}
};

// Protect older browsers from an absent console.
if (!console || !console.log) { var console = { log: function () {} }; }
if (!console.debug || !console.error || !console.info || !console.warn) {
  console.debug = console.error = console.info = console.warn = console.log;
}

/**
 * Injects a mongo web shell into the DOM wherever an element of class
 * 'mongo-web-shell' can be found. Additionally sets up the resources
 * required by the web shell, including the mws REST resource and the mws
 * CSS stylesheets.
 */
mongo.init = function () {
  var config = mongo.config = mongo.dom.retrieveConfig();
  mongo.dom.injectStylesheet(config.cssPath);
  $('.mongo-web-shell').each(function (index, shellElement) {
    var shell = new mongo.Shell(shellElement, index);
    mongo.shells[index] = shell;
    shell.injectHTML();

    // Attempt to create MWS resource on remote server.
    $.post(config.baseUrl, null, function (data, textStatus, jqXHR) {
      if (!data.res_id) {
        // TODO: Print error in shell. Improve error below.
        console.warn('No res_id received! Shell disabled.', data);
        return;
      }
      console.info('/mws/' + data.res_id, 'was created succssfully.');
      shell.attachInputHandler(data.res_id);
      shell.enableInput(true);
    },'json').fail(function (jqXHR, textStatus, errorThrown) {
      // TODO: Display error message in the mongo web shell.
      console.error('AJAX request failed:', textStatus, errorThrown);
    });
  });
};


mongo.const = (function () {
  var KEYCODES = {
    enter: 13,
    left: 37,
    up: 38,
    right: 39,
    down: 40
  };

  return {
    keycodes: KEYCODES
  };
}());


/**
 * A wrapper over the result set of a query, that users can iterate through to
 * retrieve results. Before the query is executed, users may modify the query
 * result set format through various methods such as sort().
 */
mongo.Cursor = function (mwsQuery, queryFunction, queryArgs) {
  this._shell = mwsQuery.shell;
  this._database = mwsQuery.database;
  this._collection = mwsQuery.collection;
  this._query = {
    wasExecuted: false,
    func: queryFunction,
    args: queryArgs,
    result: null
  };
  console.debug('Created mongo.Cursor:', this);
};

/**
 * Executes the stored query function, disabling result set format modification
 * methods such as sort() and enabling result set iteration methods such as
 * next(). Will execute onSuccess on query success, or instantly if the query
 * was previously successful.
 */
mongo.Cursor.prototype._executeQuery = function (onSuccess) {
  if (!this._query.wasExecuted) {
    console.debug('Executing query:', this);
    this._query.func(this, onSuccess);
    this._query.wasExecuted = true;
  } else {
    onSuccess();
  }
};

mongo.Cursor.prototype._printBatch = function () {
  var cursor = this;
  this._executeQuery(function () {
    cursor._shell.lastUsedCursor = cursor;

    var setSize = DBQuery.shellBatchSize;
    if (!mongo.util.isNumeric(setSize)) {
      // TODO: Print to shell.
      console.debug('Please set DBQuery.shellBatchSize to a valid numerical ' +
          'value.');
      return;
    }
    var batch = [];
    for (var i = 0; i < setSize; i++) {
      // pop() setSize times rather than splice(-setSize) to preserve order.
      var document_ = cursor._query.result.pop();
      if (document_ === undefined) {
        break;
      }
      batch.push(document_);
    }

    if (batch.length !== 0) {
      // TODO: Print to shell.
      console.debug('_printBatch() results:', batch);
    }
    if (cursor.hasNext()) {
      console.debug('Type "it" for more');
    }
  });
};

mongo.Cursor.prototype._storeQueryResult = function (result) {
  // For efficiency, we reverse the result. This allows us to pop() as we
  // iterate over the result set, both freeing the reference and preventing a
  // reindexing on each removal from the array as with unshift/splice().
  this._query.result = result.reverse();
};

/**
 * If a query has been executed from this cursor, prints an error message and
 * returns true. Otherwise returns false.
 */
mongo.Cursor.prototype._warnIfExecuted = function (methodName) {
  if (this._query.wasExecuted) {
    // TODO: Print warning to the shell.
    console.warn('Cannot call', methodName, 'on already executed ' +
        'mongo.Cursor.', this);
  }
  return this._query.wasExecuted;
};

mongo.Cursor.prototype.hasNext = function () {
  var retval, cursor = this;
  this._executeQuery(function () { retval = cursor._query.result.length; });
  return retval === 0 ? false : true;
};

mongo.Cursor.prototype.next = function () {
  var retval, cursor = this;
  this._executeQuery(function () { retval = cursor._query.result.pop(); });
  if (retval === undefined) {
    // TODO: Print to shell.
    console.warn('Cursor error hasNext: false', this);
  }
  return retval;
};

mongo.Cursor.prototype.sort = function (sort) {
  if (this._warnIfExecuted('sort')) { return this; }
  console.debug('mongo.Cursor would be sorted.', this);
  return this;
};


mongo.dom = (function () {
  // TODO: Document these data attributes.
  // TODO: Should each shell be able to have its own host?
  // Default config values.
  var CSS_PATH = 'mongo-web-shell.css';
  var MWS_HOST = '';

  function retrieveConfig() {
    var $curScript = $('script').last();
    var mwsHost = $curScript.data('mws-host') || MWS_HOST;
    return {
      cssPath: $curScript.data('css-path') || CSS_PATH,
      mwsHost: mwsHost,
      baseUrl: mwsHost + '/mws/'
    };
  }

  function injectStylesheet(cssPath) {
    var linkElement = document.createElement('link');
    linkElement.href = cssPath;
    linkElement.rel = 'stylesheet';
    linkElement.type = 'text/css';
    $('head').prepend(linkElement); // Prepend so css can be overridden.
  }

  return {
    retrieveConfig: retrieveConfig,
    injectStylesheet: injectStylesheet
  };
}());


mongo.keyword = (function () {
  function evaluate(shellID, keyword, arg, arg2, unusedArg) {
    var shell = mongo.shells[shellID];
    switch (keyword) {
    case 'use':
      // Since use is disabled, we don't care how many args so call right away.
      mongo.keyword.use(shell, arg, arg2, unusedArg);
      break;

    case 'it':
      mongo.keyword.it(shell); // it ignores other arguments.
      break;

    case 'help':
    case 'show':
      if (unusedArg) {
        // TODO: Print to shell.
        console.debug('Too many parameters to', keyword + '.');
        return;
      }
      mongo.keyword[keyword](shell, arg, arg2);
      break;

    default:
      // TODO: Print to shell.
      console.debug('Unknown keyword', keyword);
    }
  }

  function help(shell, arg, arg2) {
    // TODO: Implement.
    console.debug('keyword.help called.');
  }

  function it(shell) {
    var cursor = shell.lastUsedCursor;
    if (cursor && cursor.hasNext()) {
      cursor._printBatch();
      return;
    }
    // TODO: Print to shell.
    console.warn('no cursor');
  }

  function show(shell, arg) {
    // TODO: Implement.
    console.debug('keyword.show called.');
  }

  function use(shell, arg, arg2) {
    // TODO: Print to shell.
    console.debug('cannot change db: functionality disabled.');
  }

  return {
    evaluate: evaluate,
    help: help,
    it: it,
    show: show,
    use: use
  };
}());


mongo.mutateSource = (function () {
  // TODO: Handle with expression and function declarations.
  // TODO: Do LabeledStatements (break & continue) interfere with globals?
  // TODO: Calling an undefined variable results in return value undefined,
  // rather than a reference error.
  var NODE_TYPE_HANDLERS = {
    'Identifier': mutateIdentifier,
    'MemberExpression': mutateMemberExpression,
    'VariableDeclaration': mutateVariableDeclaration
  };

  /**
   * Mutates the source of the given Identifier node backed by the falafel
   * produced AST.
   *
   * We hide all global references given to the shell input inside the
   * shell.vars object associated with the shell that evaled the statement.
   * Local references (i.e. declared within functions) are untouched.
   */
  function mutateIdentifier(node, shellID) {
    // TODO: Handle `function identifier()` expressions.
    if (getLocalVariableIdentifiers(node)[node.name]) { return; }

    // Match any expression not of form '...a.iden...'.
    var parent = node.parent;
    if (parent.type === 'MemberExpression' && parent.property === node &&
        parent.computed === false) {
      return;
    }
    // Match any expression not of the form '...{iden: a}...'.
    if (parent.type === 'Property' && parent.key === node) { return; }

    node.update('mongo.shells[' + shellID + '].vars.' + node.name);
  }

  /**
   * Mutates the source of the given MemberExpression node backed by the
   * falafel produced AST.
   *
   * We replace any expressions of the form "db.collection" with a new
   * mongo.Query object using the matched identifiers.
   */
  function mutateMemberExpression(node, shellID) {
    // TODO: Resolve db reference in other identifiers.
    var dbNode = node.object, collectionNode = node.property;
    if (dbNode.type !== 'Identifier' || dbNode.name !== 'db') { return; }

    var collectionArg = collectionNode.source();
    if (collectionNode.type === 'Identifier' && !node.computed) {
      // Of the form a.collection; the identifier should be taken as a literal.
      collectionArg = '"' + collectionArg + '"';
    }

    var args = ['mongo.shells[' + shellID + ']', collectionArg].join(', ');
    var oldSrc = node.source();
    node.update('new mongo.Query(' + args + ')');
    console.debug('mutateMemberExpression(): mutated', oldSrc, 'to',
        node.source());
  }

  /**
   * Mutates the source of the given VariableDeclaration node backed by the
   * falafel produced AST.
   *
   * Outside of a function, takes each initialized declaration found in the
   * node and places it within an IIFE (i.e. `var i = 4;` => `(function () {
   * i = 4; }());`). Ordinarily, this would initialize the var to the global
   * object but since we have already replaced the vars used in the shell with
   * 'mongo.shells[id].vars.identifier', these variables will be stored there
   * instead. These IIFEs also return a value of undefined, which mimics
   * `var = ...`.
   *
   * Inside of a function, does nothing. JavaScript is function scoped so
   * identifiers local to a function (i.e. declared) will not be replaced with
   * `mongo...` and to correctly declare these function local vars, the
   * VariableDeclaration node is needed unchanged.
   */
  function mutateVariableDeclaration(node) {
    if (nodeIsInsideFunction(node)) { return; }

    var source = '';
    node.declarations.forEach(function (declarationNode) {
      if (declarationNode.init === null) { return; }
      source += '(function () { ' + declarationNode.source() + '; }());';
    });
    node.update(source);
  }

  /*
   * Returns an object of {identifier: true} for each non-global identifier
   * found within the scope of the given node. These identifiers are the
   * parameters to, and variables declared, within the containing functions.
   */
  function getLocalVariableIdentifiers(node) {
    // TODO: Handle function ID?
    var mergeObjects = mongo.util.mergeObjects;
    var identifiers = {};
    var functionNode = getContainingFunctionNode(node);
    while (functionNode !== null) {
      var paramIdentifiers = extractParamsIdentifiers(functionNode.params);
      identifiers = mergeObjects(identifiers, paramIdentifiers);
      var bodyIdentifiers = extractBodyIdentifiers(functionNode.body);
      identifiers = mergeObjects(identifiers, bodyIdentifiers);

      functionNode = getContainingFunctionNode(functionNode);
    }
    return identifiers;
  }

  /**
   * Returns {identifier: true} for all of the identifiers found in the given
   * FunctionDeclaration.params or FunctionExpression.params.
   */
  function extractParamsIdentifiers(params) {
    var identifiers = {};
    params.forEach(function (paramNode) {
      if (paramNode.type !== 'Identifier') {
        // TODO: Check what other types this can be and handle if relevant.
        console.debug('extractParamsIdentifiers: does not handle ' +
            'paramNode of type', paramNode.type);
        return;
      }
      identifiers[paramNode.name] = true;
    });
    return identifiers;
  }

  /**
   * Returns {identifier: true} for all of the declared identifiers found in
   * the given FunctionDeclaration.body or FunctionExpression.body.
   */
  function extractBodyIdentifiers(body) {
    // TODO: Can the body be anything but BlockStatement?
    if (body.type !== 'BlockStatement') { return; }

    var identifiers = {};
    body.body.forEach(function (statement) {
      if (statement.type !== 'VariableDeclaration') { return; }

      statement.declarations.forEach(function (declaration) {
        if (declaration.type !== 'VariableDeclarator') {
          // TODO: Check what other types this can be and handle if relevant.
          console.debug('extractBodyIdentifiers: does not handle ' +
              'declaration node of type', declaration.type);
          return;
        }
        var identifierNode = declaration.id;
        if (identifierNode.type !== 'Identifier') {
          // TODO: Check what other types this can be and handle if relevant.
          console.debug('extractBodyIdentifiers: does not handle ' +
              'statement node of type', identifierNode.type);
          return;
        }
        identifiers[identifierNode.name] = true;
      });
    });
    return identifiers;
  }

  /**
   * Returns the node of the function that contains the given node, or null if
   * it does not exist.
   */
  function getContainingFunctionNode(node) {
    node = node.parent;
    while (node) {
      if (node.type === 'FunctionDeclaration' ||
          node.type === 'FunctionExpression') {
        return node;
      }
      node = node.parent;
    }
    return null;
  }

  function nodeIsInsideFunction(node) {
    return (getContainingFunctionNode(node) !== null) ? true : false;
  }

  /**
   * Replaces mongo shell specific input (such as the `db.` methods) in the
   * given javascript source with the equivalent mongo web shell calls and
   * returns this mutated source. This transformation allows the code to be
   * interpretted as standard javascript in the context of this html document.
   * Also takes the ID of the shell making the call so the returned code can
   * reference the shell.
   */
  function swapMongoCalls(src, shellID) {
    var output = falafel(src, function (node) {
      if (NODE_TYPE_HANDLERS[node.type]) {
        NODE_TYPE_HANDLERS[node.type](node, shellID);
      }
    });
    return output.toString();
  }

  /**
   * Replaces mongo shell specific keywords (such as "help") in the given
   * source with a valid JavaScript function call that may be evaled and
   * returns this mutated source.
   */
  function swapKeywords(src, shellID) {
    var statements = src.split(/\s*;\s*/);
    statements.forEach(function (statement, index, arr) {
      var tokens = statement.split(/\s+/).filter(function (str) {
        return str.length !== 0;
      });
      if (/help|it|show|use/.test(tokens[0])) {
        arr[index] = convertTokensToKeywordCall(shellID, tokens);
      }
    });
    return statements.join('; ');
  }

  /**
   * Takes an array of tokens and a shellID and returns a string that contains
   * a mongo.keyword call that can be evaled.
   */
  function convertTokensToKeywordCall(shellID, tokens) {
    var tokensAsArgs = tokens.map(function (str) {
      return '\'' + str + '\''; // Pad as string literals.
    });
    var args = [shellID].concat(tokensAsArgs).join(', ');
    var func = 'mongo.keyword.evaluate';
    return func + '(' + args + ')';
  }

  return {
    swapMongoCalls: swapMongoCalls,
    swapKeywords: swapKeywords,

    _mutateIdentifier: mutateIdentifier,
    _mutateMemberExpression: mutateMemberExpression,
    _mutateVariableDeclaration: mutateVariableDeclaration,
    _getLocalVariableIdentifiers: getLocalVariableIdentifiers,
    _extractParamsIdentifiers: extractParamsIdentifiers,
    _extractBodyIdentifiers: extractBodyIdentifiers,
    _getContainingFunctionNode: getContainingFunctionNode,
    _nodeIsInsideFunction: nodeIsInsideFunction,
    _convertTokensToKeywordCall: convertTokensToKeywordCall
  };
}());


/**
 * Handles a query of the form "db.collection.method()." Some methods on this
 * object will execute the query immediately while others will return an
 * mongo.Cursor instance which is expected to continue the query lifespan.
 */
mongo.Query = function (shell, collection) {
  this.shell = shell;
  this.collection = collection;
  // The shell can change the active DB but a query's DB should be static.
  this.database = this.shell.database;
  console.debug('Create mongo.Query', this);
};

mongo.Query.prototype.find = function (query, projection) {
  var args = {query: query, projection: projection};
  return new mongo.Cursor(this, mongo.request.db_collection_find, args);
};

mongo.Query.prototype.insert = function (document_) {
  mongo.request.db_collection_insert(this, document_);
};


mongo.Readline = function ($input) {
  this.$input = $input;
  this.history = []; // Newest entries at Array.length.
  this.historyIndex = history.length;

  var readline = this;
  this.$input.keydown(function (event) { readline.keydown(event); });
};

mongo.Readline.prototype.keydown = function (event) {
  var key = mongo.const.keycodes;
  var line;
  switch (event.keyCode) {
  case key.up:
    line = this.getOlderHistoryEntry();
    break;
  case key.down:
    line = this.getNewerHistoryEntry();
    break;
  case key.enter:
    this.submit(this.$input.val());
    break;
  default:
    return;
  }

  if (line !== undefined && line !== null) {
    this.$input.val(line);
  }
};

mongo.Readline.prototype.getNewerHistoryEntry = function () {
  var old = this.historyIndex;
  this.historyIndex = Math.min(this.historyIndex + 1, this.history.length);
  if (this.historyIndex === this.history.length && old !== this.historyIndex) {
    // TODO: Restore command first being written (you may be able to remove the
    // old check, depending on how it's done).
    return '';
  }
  return this.history[this.historyIndex];
};

mongo.Readline.prototype.getOlderHistoryEntry = function () {
  this.historyIndex = Math.max(this.historyIndex - 1, 0);
  return this.history[this.historyIndex];
};

mongo.Readline.prototype.submit = function (line) {
  // TODO: Remove old entries if we've hit the limit.
  this.history.push(line);
  this.historyIndex = this.history.length;
};


mongo.request = (function () {
  function db_collection_find(cursor, onSuccess) {
    var resID = cursor._shell.mwsResourceID;
    var args = cursor._query.args;

    var url = getResURL(resID, cursor._collection) + 'find';
    var params = {
      query: args.query,
      projection: args.projection
    };
    pruneKeys(params, ['query', 'projection']);
    // For a GET request, jQuery divides each key in a JSON object into params
    // (i.e. var obj = {one: 1, two: 2} => ?obj[one]=1&obj[two]=2 ), which is
    // harder to reconstruct on the backend than just stringifying the values
    // individually, which is what we do here.
    stringifyKeys(params);

    console.debug('find() request:', url, params);
    $.getJSON(url, params, function (data, textStatus, jqXHR) {
      console.debug('db_collection_find success');
      cursor._storeQueryResult(data.result);
      onSuccess();
    }).fail(function (jqXHR, textStatus, errorThrown) {
      // TODO: Print error into shell.
      console.error('db_collection_find fail:', textStatus, errorThrown);
    });
  }

  function db_collection_insert(query, document_) {
    var resID = query.shell.mwsResourceID;
    var url = getResURL(resID, query.collection) + 'insert';
    var params = {
      document: document_
    };

    console.debug('insert() request:', url, params);
    $.ajax({
      type: 'POST',
      url: url,
      data: JSON.stringify(params),
      dataType: 'json',
      contentType: 'application/json',
      success: function (data, textStatus, jqXHR) {
        console.info('Insertion successful:', data);
      }
    }).fail(function (jqXHR, textStatus, errorThrown) {
      // TODO: Print error into shell.
      console.error('db_collection_insert fail:', textStatus, errorThrown);
    });
  }

  function getResURL(resID, collection) {
    return mongo.config.baseUrl + resID + '/db/' + collection + '/';
  }

  /**
   * Removes the given keys from the given object if they are undefined or
   * null. This can be used to make requests with optional args more compact.
   */
  function pruneKeys(obj, keys) {
    keys.forEach(function (key, index, array) {
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
    db_collection_find: db_collection_find,
    db_collection_insert: db_collection_insert,

    _getResURL: getResURL,
    _pruneKeys: pruneKeys,
    _stringifyKeys: stringifyKeys
  };
}());


mongo.Shell = function (rootElement, shellID) {
  this.$rootElement = $(rootElement);
  this.$input = null;

  this.id = shellID;
  this.mwsResourceID = null;
  this.vars = {};
  this.readline = null;
  this.lastUsedCursor = null;
};

mongo.Shell.prototype.injectHTML = function () {
  // TODO: Use client-side templating instead.
  // TODO: Why is there a border class? Can it be done with CSS border (or
  // be renamed to be more descriptive)?
  // TODO: .mshell not defined in CSS; change it.
  var html = '<div class="mws-border">' +
               '<div class="mshell">' +
                 '<ul class="mws-in-shell-response"></ul>' +
                 '<form>' +
                   '<input type="text" class="mws-input" disabled="true">' +
                 '</form>' +
               '</div>' +
             '</div>';
  this.$rootElement.html(html);
  this.$input = this.$rootElement.find('.mws-input');
};

mongo.Shell.prototype.attachInputHandler = function (mwsResourceID) {
  var shell = this;
  this.mwsResourceID = mwsResourceID;
  this.$rootElement.find('form').submit(function (e) {
    e.preventDefault();
    shell.handleInput();
  });
  this.readline = new mongo.Readline(this.$input);
};

/**
 * Retrieves the input from the mongo web shell, evaluates it, handles the
 * responses (indirectly via callbacks), and clears the input field.
 */
mongo.Shell.prototype.handleInput = function () {
  var userInput = this.$input.val();
  this.$input.val('');
  var mutatedSrc = mongo.mutateSource.swapKeywords(userInput, this.id);
  try {
    mutatedSrc = mongo.mutateSource.swapMongoCalls(mutatedSrc, this.id);
  } catch (err) {
    // TODO: Print falafel parse error to shell.
    console.error('mongo.Shell.handleInput(): falafel/esprima parse error:',
        err);
    return;
  }

  var ast;
  try {
    // XXX: We need the output of eval on each js statement so we construct the
    // AST for the second time. :( It would be more efficient to patch falafel
    // to return the ast, but I don't have time.
    ast = esprima.parse(mutatedSrc, {range: true});
  } catch (err) {
    // TODO: This is an error on the mws front since the original source
    // already passed parsing once before and we were the ones to make the
    // changes to the source. Figure out how to handle this error.
    // TODO: Print esprima parse error to shell.
    console.debug('mongo.Shell.handleInput(): esprima parse error on ' +
        'mutated source:', err, mutatedSrc);
    return;
  }

  var statements = mongo.util.sourceToStatements(mutatedSrc, ast);
  try {
    this.evalStatements(statements);
  } catch (err) {
    // TODO: Print out to shell.
    // TODO: This is probably an unknown identifier error. We should be hiding
    // the identifiers from the global object by hand (to be implemented
    // later) so so this is likely our fault. Figure out how to handle.
    // TODO: "var i = 1;" throws a TypeError here. Find out why.
    console.error('mongo.Shell.handleInput(): eval error on:', err.statement,
        err);
  }
};

/**
 * Calls eval on the given array of javascript statements. This method will
 * throw any exceptions eval throws with an added exception.statement attribute
 * that is equivalent to the statement eval failed on.
 */
mongo.Shell.prototype.evalStatements = function (statements) {
  statements.forEach(function (statement, index, array) {
    console.debug('mongo.Shell.handleInput(): Evaling', index, statement);
    var out;
    try {
      out = eval(statement);
    } catch (err) {
      // eval does not mention which statement it failed on so we append that
      // information ourselves and rethrow.
      err.statement = statement;
      throw err;
    }
    // TODO: Since the result is returned asynchronously, multiple JS
    // statements entered on one line in the shell may have their results
    // printed out of order. Fix this.
    if (out instanceof mongo.Cursor) {
      // We execute the query lazily so result set modification methods (such
      // as sort()) can be called before the query's execution.
      out._executeQuery(function() { out._printBatch(); });
    } else if (out !== undefined) {
      // TODO: Print out to shell.
      console.debug('mongo.Shell.handleInput(): shell output:', out.toString(),
          out);
    }
  });
};

mongo.Shell.prototype.enableInput = function (bool) {
  this.$input.get(0).disabled = !bool;
};


mongo.util = (function () {
  function isNumeric(val) {
    return typeof val === 'number' && !isNaN(val);
  }

  /**
   * Returns an object with the key-value pairs from both given objects. If
   * there is a conflict, the pairs in obj1 take precedence over those in obj2.
   */
  function mergeObjects(obj1, obj2) {
    // TODO: Generalize this to an arbitrary number of arguments.
    var out = {};
    addOwnProperties(out, obj2);
    addOwnProperties(out, obj1);
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
    ast.body.forEach(function (statementNode, index, array) {
      var srcIndices = statementNode.range;
      statements.push(src.substring(srcIndices[0], srcIndices[1]));
    });
    return statements;
  }

  return {
    isNumeric: isNumeric,
    mergeObjects: mergeObjects,
    sourceToStatements: sourceToStatements,

    _addOwnProperties: addOwnProperties
  };
}());

// TODO: Move this into the shell's local variables when implemented. This will
// allow both multiple shells to have different values and reduce the global
// variable use back to just "mongo".
var DBQuery = {
  shellBatchSize: 20
};

$(document).ready(mongo.init);
