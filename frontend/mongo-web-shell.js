/* jshint camelcase: false, evil: true, unused: false */
/* global esprima, falafel */
var mongo = {
  shells: {} // {shellID: MWShell}
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
  var config = mongo.dom.retrieveConfig();
  mongo.dom.injectStylesheet(config.cssPath);
  $('.mongo-web-shell').each(function (index, shellElement) {
    var shell = new MWShell(shellElement, index);
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

mongo.dom = (function () {
  // TODO: Document these data attributes.
  // TODO: Should each shell be able to have its own host?
  // Default config values.
  var CSS_PATH = 'mongo-web-shell.css';
  var MWS_HOST = 'http://localhost:5000';
  var BASE_URL = MWS_HOST + '/mws';

  function retrieveConfig() {
    var $curScript = $('script').last();
    var mwsHost = $curScript.data('mws-host') || MWS_HOST;
    return {
      cssPath: $curScript.data('css-path') || CSS_PATH,
      mwsHost: mwsHost,
      baseUrl: mwsHost + '/mws'
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

mongo.mutateSource = (function () {
  var KEYWORDS = {
    help: true,
    show: true,
    use: true
  };
  function isKeyword(id) { return KEYWORDS[id]; }

  var NODE_TYPE_HANDLERS = {
    'MemberExpression': mutateMemberExpression,
    'UnaryExpression': mutateUnaryExpression
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
    node.update('new MWSQuery(' + args + ')');
    console.debug('mutateMemberExpression(): mutated', oldSrc, 'to',
        node.source());
  }

  function mutateUnaryExpression(node) {
    switch (node.operator) {
    case 'help':
    case 'show':
    case 'use':
      console.warn('mutateUnaryExpression(): mutation of keyword "' +
          node.operator + '" not yet implemented. Removing node source to ' +
          'prevent parser errors.');
      node.update('');
      break;
    default:
      console.debug('mutateUnaryExpression(): keyword "' + node.operator +
          '" is not mongo specific. Ignoring.');
    }
  }

  /**
   * Replaces mongo shell specific input (such as the `show` keyword or * `db.`
   * methods) in the given javascript source with the equivalent mongo web
   * shell calls and returns this mutated source. This transformation allows
   * the code to be interpretted as standard javascript in the context of this
   * html document. Also takes the ID of the shell making the call so the
   * returned code can reference the shell.
   */
  function swapMongoCalls(src, shellID) {
    var output = falafel(src, {isKeyword: isKeyword}, function (node) {
      if (NODE_TYPE_HANDLERS[node.type]) {
        NODE_TYPE_HANDLERS[node.type](node, shellID);
      }
    });
    return output.toString();
  }

  return {
    swapMongoCalls: swapMongoCalls,

    _isKeyword: isKeyword,
    _mutateMemberExpression: mutateMemberExpression,
    _mutateUnaryExpression: mutateUnaryExpression
  };
}());

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

var MWShell = function (rootElement, shellID) {
  this.$rootElement = $(rootElement);
  this.$input = null;

  this.id = shellID;
  this.mwsResourceID = null;
  this.readline = null;

  this.database = 'test'; // The name of the active mongo database.
};

MWShell.prototype.injectHTML = function () {
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

MWShell.prototype.attachInputHandler = function (mwsResourceID) {
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
MWShell.prototype.handleInput = function () {
  var mutatedSrc, userInput = this.$input.val();
  this.$input.val('');
  try {
    mutatedSrc = mongo.mutateSource.swapMongoCalls(userInput, this.id);
  } catch (err) {
    // TODO: Print falafel parse error to shell.
    console.error('MWShell.handleInput(): falafel/esprima parse error:', err);
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
    console.debug('MWShell.handleInput(): esprima parse error on mutated ' +
        'source:', err, mutatedSrc);
    return;
  }

  try {
    for (var i = 0; i < ast.body.length; i++) {
      var srcIndices = ast.body[i].range;
      var statement = mutatedSrc.substring(srcIndices[0], srcIndices[1]);
      console.debug('MWShell.handleInput(): Evaling', i, statement);
      var out = eval(statement);
      if (out instanceof MWSCursor) {
        // TODO: Lazily execute remote query of MWSCursor.
        console.debug('MWShell.handleInput(): would execute remote query on ' +
            'MWSCursor:', out);
      } else {
        // TODO: Print out to shell.
        console.debug('MWShell.handleInput(): shell output:', out.toString(),
            out);
      }
    }
  } catch (err) {
    // TODO: Print out to shell.
    // TODO: This is probably an unknown identifier error. We should be hiding
    // the identifiers from the global object by hand (to be implemented
    // later) so so this is likely our fault. Figure out how to handle.
    // TODO: "var i = 1;" throws a TypeError here. Find out why.
    console.error('MWShell.handleInput(): eval error:', err);
  }
};

MWShell.prototype.enableInput = function (bool) {
  this.$input.get(0).disabled = !bool;
};

/**
 * Handles a query of the form "db.collection.method()." Each method on this
 * object will return an MWSCursor which is expected to continue the query
 * lifecycle by propagating the request to the remote mongo web service and
 * associated database.
 */
var MWSQuery = function (shell, collection) {
  this.shell = shell;
  this.collection = collection;
  // The shell can change the active DB but a query's DB should be static.
  this.database = this.shell.database;
  console.debug('Create MWSQuery', this);
};

MWSQuery.prototype.find = function (query, projection) {
  // TODO: Implement.
  console.debug('find called:', this);
  return new MWSCursor(this);
};

/**
 * Provides a user with methods to modify the query result format, propagates
 * this request to the remote mongo web service and associated database, and
 * provides methods so a user can iterate through the results.
 *
 * The remote request is handled lazily - the query will only execute after all
 * of the expressions in the statement containing the cursor are evaluated.
 * After the request is sent, methods that modify the query result (e.g. sort)
 * can no longer be called and result iteration methods are enabled.
 */
var MWSCursor = function (mwsQuery) {
  this.shell = mwsQuery.shell;
  this.database = mwsQuery.database;
  this.collection = mwsQuery.collection;
  this.executed = false;
  console.debug('Created MWSCursor:', this);
};

/**
 * If a remote request has been made from this cursor, prints an error message
 * and returns true. Otherwise returns false.
 */
MWSCursor.prototype._warnIfExecuted = function () {
  if (this.executed) {
    // TODO: Print warning to the shell.
    console.warn('Cannot call sort on already executed MWSCursor.', this);
  }
  return this.executed;
};

MWSCursor.prototype.sort = function (sort) {
  if (this._warnIfExecuted()) { return this; }
  console.debug('MWSCursor would be sorted.', this);
  return this;
};

$(document).ready(mongo.init);
