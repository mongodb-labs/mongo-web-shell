/* jshint evil: true */
/* global console, esprima, mongo */
mongo.Shell = function (rootElement, shellID) {
  this.$rootElement = $(rootElement);
  this.$responseList = null;
  this.$inputLI = null;
  this.$input = null;

  this.id = shellID;
  this.mwsResourceID = null;
  this.readline = null;
  this.lastUsedCursor = null;
  // Todo: Should we put this somewhere else?
  this.vars = {
    DBQuery: {
      shellBatchSize: mongo.const.shellBatchSize
    }
  };
  this.db = new mongo.DB(this, 'test');
};

mongo.Shell.prototype.injectHTML = function () {
  // TODO: Use client-side templating instead.
  // We're injecting into <div class="mongo-web-shell">. The previous HTML
  // content is used to fill the shell.
  var html =
      '<ul class="mws-response-list">' +
        '<li>' + this.$rootElement.html() + '</li>' +
        '<li class="mws-input-li">' +
          '&gt;' +
          '<form class="mws-form">' +
            '<input type="text" class="mws-input" disabled="true">' +
          '</form>' +
        '</li>' +
      '</ul>';
  this.$rootElement.html(html);
  this.$responseList = this.$rootElement.find('.mws-response-list');
  this.$inputLI = this.$responseList.find('.mws-input-li');
  this.$input = this.$inputLI.find('.mws-input');

  // Todo: We should whitelist what is available in this namespace
  // e.g. get rid of parent
  this.$sandbox = $('<iframe width="0" height="0"></iframe>')
    .css({visibility : 'hidden'})
    .appendTo('body');
  this.$sandbox = this.$sandbox.get(0);

  this.$sandbox.contentWindow.print = function(){
    this.insertResponseLine($.makeArray(arguments).map(function(e){
      return mongo.util.toString(e);
    }).join(' '));
  }.bind(this);
  this.$sandbox.contentWindow.__get = mongo.util.__get;
  this.$sandbox.contentWindow.db = this.db;
};

mongo.Shell.prototype.attachClickListener = function () {
  this.$rootElement.click(this.onClick.bind(this));
};

mongo.Shell.prototype.onClick = function () { this.$input.focus(); };

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
  this.insertResponseLine('> ' + userInput);

  if (mongo.keyword.handleKeywords(this, userInput)) {
    return;
  }

  var mutatedSrc;
  try {
    mutatedSrc = mongo.mutateSource.swapMemberAccesses(userInput);
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
    if (err instanceof mongo.CollectionNameError){
      this.insertResponseLine('ERROR: ' + err.message);
      console.error('mongo.Shell.handleInput(): ' + err.message);
    } else {
      // TODO: Figure out why an error might occur here and handle it.
      this.insertResponseLine('ERROR: eval error on: ' + err.statement);
      console.error('mongo.Shell.handleInput(): eval error on:', err.statement, err);
    }
  }
};

/**
 * Calls eval on the given array of javascript statements. This method will
 * throw any exceptions eval throws with an added exception.statement attribute
 * that is equivalent to the statement eval failed on.
 */
mongo.Shell.prototype.evalStatements = function (statements) {
  statements.forEach(function (statement, index) {
    console.debug('mongo.Shell.handleInput(): Evaling', index, statement);
    var out;
    try {
      out = this.$sandbox.contentWindow.eval(statement);
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
      this.insertResponseLine(mongo.util.toString(out));
    }
  }, this);
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

  // Reset scroll distance so the <input> is not hidden at the bottom.
  this.$responseList.scrollTop(this.$responseList[0].scrollHeight);
};

mongo.Shell.prototype.keepAlive = function () {
  mongo.request.keepAlive(this);
};

/**
 * Returns the shellBatchSize from the shell's local vars if it's valid,
 * otherwise throws an error.
 */
mongo.Shell.prototype.getShellBatchSize = function () {
  var size = this.vars.DBQuery.shellBatchSize;
  if (!mongo.util.isNumeric(size)) {
    this.insertResponseLine('ERROR: Please set ' +
      'DBQuery.shellBatchSize to a valid numerical value.');
    console.debug('Please set DBQuery.shellBatchSize to a valid numerical ' +
        'value.');
    // TODO: Make the error throwing more robust.
    throw 'Bad shell batch size.';
  }
  return size;
};
