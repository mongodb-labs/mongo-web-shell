/* jshint evil: true */
/* global console, mongo */
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

  this.$sandbox.contentWindow.print = function(expr){
    this.insertResponseLine(mongo.util.toString(expr));
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

  try {
    var mutatedSrc = mongo.mutateSource.swapMemberAccesses(userInput);
    this.eval(mutatedSrc);
  } catch (err) {
    this.insertError(err);
  }
};

/**
 * Calls eval on the given array of javascript statements. This method will
 * throw any exceptions eval throws.
 */
mongo.Shell.prototype.eval = function (src) {
  var out = this.$sandbox.contentWindow.eval(src);
  // TODO: Since the result is returned asynchronously, multiple JS
  // statements entered on one line in the shell may have their results
  // printed out of order. Fix this.
  if (out instanceof mongo.Cursor) {
    out._printBatch();
  } else if (out !== undefined) {
    this.insertResponseLine(out);
  }
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
  li.innerHTML = mongo.util.toString(data);
  this.$inputLI.before(li);

  // Reset scroll distance so the <input> is not hidden at the bottom.
  this.$responseList.scrollTop(this.$responseList[0].scrollHeight);
};

mongo.Shell.prototype.insertError = function (err) {
  if (err instanceof Error || err instanceof this.$sandbox.contentWindow.Error) {
    err = err.toString();
  } else if (err.message) {
    err = 'ERROR: ' + err.message;
  } else {
    err = 'ERROR: ' + err;
  }
  this.insertResponseLine(err);
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
