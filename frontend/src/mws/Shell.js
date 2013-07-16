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
  this.shellBatchSize = mongo.const.shellBatchSize;
  this.db = new mongo.DB(this, 'test');

  this.injectHTML();
  this.attachClickListener();
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
  this.$rootElement.html(html).data('shell', this);
  this.$responseList = this.$rootElement.find('.mws-response-list');
  this.$inputLI = this.$responseList.find('.mws-input-li');
  this.$input = this.$inputLI.find('.mws-input');

  // Todo: We should whitelist what is available in this namespace
  // e.g. get rid of parent
  this.sandbox = $('<iframe width="0" height="0"></iframe>')
    .css({visibility : 'hidden'})
    .appendTo('body')
    .get(0);
  this.context = this.sandbox.contentWindow;

  this.context.print = function(){
    this.insertResponseLine($.makeArray(arguments).map(function(e){
      return mongo.util.toString(e);
    }).join(' '));
  }.bind(this);
  this.context.__get = mongo.util.__get;
  this.context.db = this.db;

  this.context.tojson = mongo.jsonUtils.tojson;
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
  this.enableInput(true);
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
  var out = this.context.eval(src);
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
  $(li).addClass('mws-response').html(mongo.util.toString(data));
  this.$inputLI.before(li);

  // Reset scroll distance so the <input> is not hidden at the bottom.
  this.$responseList.scrollTop(this.$responseList[0].scrollHeight);
};

mongo.Shell.prototype.insertError = function (err) {
  if (err instanceof Error || err instanceof this.context.Error) {
    err = err.toString();
  } else if (err.message) {
    err = 'ERROR: ' + err.message;
  } else {
    err = 'ERROR: ' + err;
  }
  this.insertResponseLine(err);
};

/**
 * Returns the shellBatchSize from the shell's local vars if it's valid,
 * otherwise throws an error.
 */
mongo.Shell.prototype.getShellBatchSize = function () {
  var size = this.shellBatchSize;
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
