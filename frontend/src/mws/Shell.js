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

/* jshint evil: true, newcap: false */
/* global console, mongo, CodeMirror, Evaluator */
mongo.Shell = function (rootElement, shellID) {
  this.$rootElement = $(rootElement);

  this.hasShownResponse = false;
  this.id = shellID;
  this.mwsResourceID = null;
  this.readline = null;
  this.lastUsedCursor = null;
  this.shellBatchSize = mongo.config.shellBatchSize;
  this.db = new mongo.DB(this, 'test');

  this.injectHTML();
  this.attachClickListener();
};

mongo.Shell.prototype.injectHTML = function () {
  // TODO: Use client-side templating instead.
  this.$rootElement.addClass('cm-s-solarized').addClass('cm-s-dark');
  this.$rootElement.html(
    '<div class="mws-scroll-wrapper cm-s-solarized cm-s-dark">' +
      // We're injecting into <div class="mongo-web-shell">. The previous HTML
      // content is used to fill the shell.
      this.$rootElement.html() +
      '<div class="mws-responses"/>' +
      '<div class="mws-input-wrapper">' +
        '<div class="mws-prompt">&gt;</div>' +
        '<div class="mws-input"></div>' +
      '</div>' +
    '</div>'
  );
  this.$responseWrapper = this.$rootElement.find('.mws-responses');
  this.responseBlock = CodeMirror(this.$responseWrapper.get(0), {
    readOnly: true,
    lineWrapping: true,
    theme: 'solarized dark'
  });
  // We want the response box to be hidden until there is a response to show
  // (it gets shown in insertResponseLine).
  this.$responseWrapper.css({display: 'none'});

  this.inputBox = CodeMirror(this.$rootElement.find('.mws-input').get(0), {
    matchBrackets: true,
    lineWrapping: true,
    readOnly: 'nocursor',
    theme: 'solarized dark'
  });
  $(this.inputBox.getWrapperElement()).css({background: 'transparent'});

  // Start with prompt hidden
  this.$inputPrompt = this.$rootElement.find('.mws-prompt').hide();

  this.$inputWrapper = this.$rootElement.find('.mws-input-wrapper');
  this.$scrollWrapper = this.$rootElement.find('.mws-scroll-wrapper');

  // Todo: We should whitelist what is available in this namespace
  // e.g. get rid of parent
  this.evaluator = new Evaluator();

  this.evaluator.setGlobal('print', function(){
    this.insertResponseLine($.makeArray(arguments).map(function(e){
      return mongo.util.toString(e);
    }).join(' '));
  }.bind(this));
  this.evaluator.setGlobal('__get', mongo.util.__get);
  this.evaluator.setGlobal('db', this.db);
};

mongo.Shell.prototype.attachClickListener = function () {
  this.$rootElement.click(function () {
    this.inputBox.focus();
    this.inputBox.refresh();
    this.responseBlock.setSelection({line: 0, ch: 0});
  }.bind(this));
};

mongo.Shell.prototype.attachInputHandler = function (mwsResourceID) {
  this.mwsResourceID = mwsResourceID;
  this.readline = new mongo.Readline(this.inputBox, this.handleInput.bind(this));
  this.enableInput(true);
};

/**
 * Retrieves the input from the mongo web shell, evaluates it, handles the
 * responses (indirectly via callbacks), and clears the input field.
 */
mongo.Shell.prototype.handleInput = function () {
  var userInput = this.inputBox.getValue();
  if(userInput.trim === ''){
    this.insertResponseLine('>');
  }
  this.insertResponseLine(userInput, '> ');
  this.inputBox.setValue('');
  if (!mongo.keyword.handleKeywords(this, userInput)) {
    try {
      var mutatedSrc = mongo.mutateSource.swapMemberAccesses(userInput);
      this.eval(mutatedSrc);
    } catch (err) {
      this.insertError(err);
    }
  }
};

/**
 * Calls eval on the given array of javascript statements. This method will
 * throw any exceptions eval throws.
 */
mongo.Shell.prototype.eval = function (src) {
  this.evaluator.eval(src, function (out, isError) {
    if (isError) {
      this.insertError(out);
    } else {
      if (out instanceof mongo.Cursor) {
        out._printBatch();
      } else if (out !== undefined) {
        this.insertResponseLine(out);
      }
    }
  }.bind(this));
};

mongo.Shell.prototype.enableInput = function (bool) {
  var readOnly = bool ? false : 'nocursor';
  this.inputBox.setOption('readOnly', readOnly);
  if (bool) {
    this.$inputPrompt.show();
  } else {
    this.$inputPrompt.hide();
  }
};

mongo.Shell.prototype.focus = function() {
  this.inputBox.focus();
};

mongo.Shell.prototype.insertResponseArray = function (data) {
  for (var i = 0; i < data.length; i++) {
    this.insertResponseLine(data[i], null, true);
  }
  this.responseBlock.refresh();
};

mongo.Shell.prototype.insertResponseLine = function (data, prepend, noRefresh) {
  var lastLine = this.responseBlock.lineCount() - 1;
  var lastChar = this.responseBlock.getLine(lastLine).length;
  var lastPos = {line: lastLine, ch: lastChar};
  var isString = typeof(data) === 'string';
  var separator = this.hasShownResponse ? '\n' : '';

  data = mongo.util.toString(data);
  if (prepend) {
    data = prepend + data;
    var padding = Array(prepend.length + 1).join(' ');
    data = data.replace(/\n/g, '\n' + padding);
  }
  this.responseBlock.replaceRange(separator + data, lastPos);

  if (isString && !prepend) {
    var newLines = data.match(/\n/g);
    var insertedLines = newLines ? newLines.length + 1 : 1;
    var totalLines = this.responseBlock.lineCount();
    var startInsertedResponse = totalLines - insertedLines;
    for (var i = startInsertedResponse; i < totalLines; i++) {
      this.responseBlock.addLineClass(i, 'text', 'mws-cm-plain-text');
    }
  }

  this.hasShownResponse = true;
  this.$responseWrapper.css({display: ''});
  this.$inputWrapper.css({marginTop: '-8px'});

  if (!noRefresh) {
    this.responseBlock.refresh();
  }
  // Reset scroll distance so the input is not hidden at the bottom.
  this.$scrollWrapper.scrollTop(this.$scrollWrapper.get(0).scrollHeight);
};

mongo.Shell.prototype.insertError = function (err) {
  if (err instanceof Error || err instanceof this.evaluator.getGlobal('Error')) {
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
