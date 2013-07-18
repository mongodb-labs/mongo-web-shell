/* jshint evil: true, newcap: false */
/* global console, mongo, CodeMirror */
mongo.Shell = function (rootElement, shellID) {
  this.rootElement = rootElement;
  this.$rootElement = $(rootElement);
  this.$responseList = null;
  this.$inputLI = null;
  this.inputBox = null;

  this.hasShownResponse = false;
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

  this.injectHTML();
  this.attachClickListener();
};

mongo.Shell.prototype.injectHTML = function () {
  // TODO: Use client-side templating instead.
  // We're injecting into <div class="mongo-web-shell">. The previous HTML
  // content is used to fill the shell.
//  var html =
//      '<ul class="mws-response-list cm-s-solarized cm-s-dark">' +
//        '<li>' + this.$rootElement.html() + '</li>' +
//        '<li class="mws-input-li">' +
//          '> ' +
//        '</li>' +
//      '</ul>';
//  this.$rootElement.html(html);
//  this.$responseList = this.$rootElement.find('.mws-response-list');
//  this.$inputLI = this.$responseList.find('.mws-input-li');
  this.rootElement.className += ' cm-s-solarized cm-s-dark';
  this.$rootElement.html(
    '<div class="mws-scroll-wrapper">' +
      this.$rootElement.html() +
      '<textarea class="mws-responses"/>' +
      '<div class="mws-input-div">></div>' +
    '</div>'
  );
  var responsesTextArea = this.$rootElement.find('.mws-responses').get(0);
  this.responseBlock = CodeMirror.fromTextArea(responsesTextArea, {
    readOnly: true,
    lineWrapping: true,
    theme: 'solarized dark'
  });
  this.$responseWrapper = $(this.responseBlock.getWrapperElement());
  this.$responseWrapper.css({display: 'none'});

  var inputContainer = this.$rootElement.find('.mws-input-div').get(0);
  this.inputBox = CodeMirror(inputContainer, {
    matchBrackets: true,
    lineWrapping: true,
    readOnly: 'nocursor',
    theme: 'solarized dark'
  });
  this.$inputWrapper = $(this.inputBox.getWrapperElement());
  this.$inputWrapper.css({background: 'transparent'});
  this.$inputDiv = this.$rootElement.find('.mws-input-div');
  this.$scrollWrapper = this.$rootElement.find('.mws-scroll-wrapper');

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
  this.$rootElement.click(function () {
    console.log('in click listener');
    this.inputBox.focus();
    this.inputBox.refresh();
//    this.$inputWrapper.css({display: ''});
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
  this.inputBox.setValue('');
  this.insertResponseLine(userInput, '> ');

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
  var readOnly = bool ? false : 'nocursor';
  this.inputBox.setOption('readOnly', readOnly);
};

mongo.Shell.prototype.insertResponseArray = function (data) {
  // Todo: Make this more efficient, don't update the DOM each time, do a
  // single large insert and then update
  for (var i = 0; i < data.length; i++) {
    this.insertResponseLine(data[i]);
  }
};

mongo.Shell.prototype.insertResponseLine = function (data, prepend) {
  var lastLine = this.responseBlock.lineCount() - 1;
  var lastChar = this.responseBlock.getLine(lastLine).length;
  var lastPos = {line: lastLine, ch: lastChar};

  if (prepend) {
    data = prepend + data;
  }
  this.$responseWrapper.css({display: ''});
  this.$inputDiv.css({marginTop: '-8px'});
  var separator = this.hasShownResponse ? '\n' : '';
  this.responseBlock.replaceRange(separator + data, lastPos);
//  this.responseBlock.setValue(this.responseBlock.getValue() + separator + data);

  if (typeof(data) === 'string' && !prepend) {
    var newLastLine = this.responseBlock.lineCount() - 1;
    this.responseBlock.addLineClass(newLastLine, 'text', 'mws-cm-plain-text');
  }

  this.responseBlock.refresh();
  this.hasShownResponse = true;
//  var li = document.createElement('li');
//  this.$inputLI.before(li);
//  if (prepend) {
//    li.innerHTML = prepend;
//  }
//  if (typeof(data) === 'string' && !prepend) {
//    // If we're printing an output and it's a string, don't highlight
//    li.innerHTML = mongo.util.toString(data);
//    li.className = 'mws-plain-result';
//  } else {
//    var cm = CodeMirror(li, {
//      readOnly: true,
//      value: mongo.util.toString(data),
//      theme: 'solarized dark'
//    });
//    cm.refresh();
//  }

  // Reset scroll distance so the <input> is not hidden at the bottom.
//  this.$responseList.scrollTop(this.$responseList[0].scrollHeight);
  this.$scrollWrapper.scrollTop(this.$scrollWrapper.get(0).scrollHeight);
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
