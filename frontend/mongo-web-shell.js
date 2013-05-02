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
    $(shell.$rootElement).click(function() {
      $(shell.$input).focus();
    });

    // Attempt to create MWS resource on remote server.
    $.post(config.baseUrl, null, function (data, textStatus, jqXHR) {
      if (!data.res_id) {
        shell.insertResponseLine('ERROR: No res_id recieved! Shell disabled.');
        console.warn('No res_id received! Shell disabled.', data);
        return;
      }
      console.info('/mws/' + data.res_id, 'was created succssfully.');
      shell.attachInputHandler(data.res_id);
      shell.enableInput(true);
      setInterval(function () { shell.keepAlive(); }, 30000);
    },'json').fail(function (jqXHR, textStatus, errorThrown) {
      shell.insertResponseLine('Failed to create resources on DB on server');
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
  this.shell = mwsQuery.shell;
  this.database = mwsQuery.database;
  this.collection = mwsQuery.collection;
  this.query = {
    wasExecuted: false,
    func: queryFunction,
    args: queryArgs
  };
  console.debug('Created mongo.Cursor:', this);
};

/**
 * Executes the stored query function, disabling result set format modification
 * methods such as sort() and enabling result set iteration methods such as
 * next().
 */
mongo.Cursor.prototype.executeQuery = function () {
  console.debug('Executing query:', this);
  this.query.func(this);
  this.query.wasExecuted = true;
};

/**
 * If a query has been executed from this cursor, prints an error message and
 * returns true. Otherwise returns false.
 */
mongo.Cursor.prototype._warnIfExecuted = function (methodName) {
  if (this.query.wasExecuted) {
    this.shell.insertResponseLine('Warning: Cannot call ' + methodName +
        ' on already executed mongo.Cursor.' + this);
    console.warn('Cannot call', methodName, 'on already executed ' +
        'mongo.Cursor.', this);
  }
  return this.query.wasExecuted;
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

    case 'help':
    case 'show':
      if (unusedArg) {
        this.shell.insertResponseLine('Too many parameters to '+
            keyword + '.');
        console.debug('Too many parameters to', keyword + '.');
        return;
      }
      mongo.keyword[keyword](shell, arg, arg2);
      break;

    default:
      this.shell.insertResponseLine('Unknown keyword: ' + keyword + '.');
      console.debug('Unknown keyword', keyword);
    }
  }

  function help(shell, arg, arg2) {
    // TODO: Implement.
    console.debug('keyword.help called.');
  }

  function show(shell, arg) {
    // TODO: Implement.
    console.debug('keyword.show called.');
  }

  function use(shell, arg, arg2) {
    console.debug('cannot change db: functionality disabled.');
    this.shell.insertResponseLine('Cannot change db: functionality disabled.');
  }

  return {
    evaluate: evaluate,
    help: help,
    show: show,
    use: use
  };
}());


mongo.mutateSource = (function () {
  var NODE_TYPE_HANDLERS = {
    'MemberExpression': mutateMemberExpression
  };

  function mutateMemberExpression(node, shellID) {
    // Search for an expression of the form "db.collection.method()",
    // attempting to match from the "db.collection" MemberExpression node as
    // this is the one that will be modified.
    var dbNode = node.object, collectionNode = node.property,
        methodNode = node.parent;
    // TODO: Resolve db reference from a CallExpression.
    // TODO: Resolve db.collection reference from a CallExpression.
    if (dbNode.type !== 'Identifier') { return; }
    // TODO: Resolve db reference in other identifiers.
    if (dbNode.name !== 'db') { return; }
    if (collectionNode.type !== 'Identifier') {
      // TODO: Can collectionNode be of any other types?
      console.debug('collectionNode not of type Identifier.', collectionNode);
      return;
    }
    // As long as this AST is deeper than "db.collection", continue.
    if (methodNode.type === 'ExpressionStatement') { return; }

    var collectionArg = collectionNode.source();
    if (node.computed) {
      // TODO: We must substitute the given identifier for one not on the
      // global object. This may be taken care of elsewhere.
      console.error('mutateMemberExpression(): node.computed not yet' +
          'implemented.');
      return;
    } else {
      // The collection identifier should be taken from the user as a literal.
      collectionArg = '"' + collectionArg + '"';
    }

    var args = ['mongo.shells[' + shellID + ']', collectionArg].join(', ');
    var oldSrc = node.source();
    node.update('new mongo.Query(' + args + ')');
    console.debug('mutateMemberExpression(): mutated', oldSrc, 'to',
        node.source());
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
      if (/help|show|use/.test(tokens[0])) {
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

    _mutateMemberExpression: mutateMemberExpression,
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
  function db_collection_find(cursor) {
    var resID = cursor.shell.mwsResourceID;
    var args = cursor.query.args;

    var url = getResURL(resID, cursor.collection) + 'find';
    var params = {
      // TODO: This shouldn't be resID but will probably get removed anyway.
      db: resID,
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
      // TODO: Insert response into shell.
      console.debug('db_collection_find success:', data);
    }).fail(function (jqXHR, textStatus, errorThrown) {
      cursor.shell.insertResponseLine(
          'ERROR: db_collection_find failed because ' + errorThrown);
      console.error('db_collection_find fail:', textStatus, errorThrown);
    });
  }

  function db_collection_insert(query, document_) {
    var resID = query.shell.mwsResourceID;
    var url = getResURL(resID, query.collection) + 'insert';
    var params = {
      // TODO: This shouldn't be resID but will probably get removed anyway.
      db: resID,
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
      query.shell.insertResponseLine(
          'ERROR: db_collection_insert failed because ' + errorThrown);
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
  this.$inputLI = null;
  this.$responseList = null;
  this.id = shellID;
  this.mwsResourceID = null;
  this.readline = null;
};

mongo.Shell.prototype.injectHTML = function () {
  // TODO: Use client-side templating instead.
  var html = '<div class="mws-body">' +
               '<ul class="mws-response-list">' +
                 '<li>' +
                   this.$rootElement.html() +
                 '</li>' +
                 '<li class="input-li">' +
                   '&gt;' +
                   '<form class="mws-form">' +
                     '<input type="text" class="mws-input" disabled="true">' +
                   '</form>' +
                 '</li>' +
               '</ul>' +
             '</div>';
  this.$rootElement.html(html);
  this.$input = this.$rootElement.find('.mws-input');
  this.$inputLI = this.$rootElement.find('.input-li');
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
  this.insertResponseLine(userInput);
  var mutatedSrc = mongo.mutateSource.swapKeywords(userInput, this.id);
  try {
    mutatedSrc = mongo.mutateSource.swapMongoCalls(mutatedSrc, this.id);
  } catch (err) {
    this.insertResponseLine('ERROR: syntax parsing error');
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
    this.insertResponseLine('ERROR: syntax parsing error');
    console.debug('mongo.Shell.handleInput(): esprima parse error on ' +
        'mutated source:', err, mutatedSrc);
    return;
  }

  var statements = mongo.util.sourceToStatements(mutatedSrc, ast);
  try {
    this.evalStatements(statements);
  } catch (err) {
    // TODO: This is probably an unknown identifier error. We should be hiding
    // the identifiers from the global object by hand (to be implemented
    // later) so so this is likely our fault. Figure out how to handle.
    // TODO: "var i = 1;" throws a TypeError here. Find out why.
    this.insertResponseLine('ERROR: eval error on: ' + err.statement);
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
  var me = this;
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
      out.executeQuery();
    } else if (out !== undefined) {
      me.insertResponseLine(out);
    }
  });
};

mongo.Shell.prototype.enableInput = function (bool) {
  this.$input.get(0).disabled = !bool;
};

mongo.Shell.prototype.insertResponseArray = function (data) {
  for (var i = 0; i < data.length; i++) {
    this.insertResponseLine(data[i]);
  }
};

mongo.Shell.prototype.insertResponseLine = function (data) {
  var li = document.createElement('li');
  li.innerHTML = data;
  this.$inputLI.before(li);

  // scrolling
  var scrollArea = this.$rootElement.find('.mws-response-list').get(0);
  scrollArea.scrollTop = scrollArea.scrollHeight;
};

mongo.Shell.prototype.keepAlive = function() {
  var shell = this;
  var resID = this.mwsResourceID;
  var url = mongo.config.baseUrl + resID + '/keep-alive';
  $.ajax({
    type: 'POST',
    url: url,
    data: {res_id: resID},
    dataType: 'json',
    contentType: 'application/json',
    success: function (data, textStatus, jqXHR) {
      console.info('Kept Alive');
    }
  }).fail(function (jqXHR, textStatus, errorThrown) {
    shell.insertResponseLine('ERROR: Failed to send keep alive');
  });
};

mongo.util = (function () {
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
    sourceToStatements: sourceToStatements
  };
}());

$(document).ready(mongo.init);
