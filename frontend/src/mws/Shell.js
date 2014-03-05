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

mongo.Shell.prototype.autocomplete = function(cm) {
  var shell = this;
  var showCollections = function(editor, callback, options) {
    var cur = editor.getCursor();
    var token = editor.getTokenAt(cur);
    var tprop = token;
    if (/\b(?:string|comment)\b/.test(token.type)) return;
    token.state = CodeMirror.innerMode(editor.getMode(), token.state).state;

    // If it's not a 'word-style' token, ignore the token.
    if (!/^[\w$_]*$/.test(token.string)) {
      token = tprop = {start: cur.ch, end: cur.ch, string: "", state: token.state,
                       type: token.string == "." ? "property" : null};
    }

    // this callback needs to be called regardless of if any autocompletions are available to make sure not to
    // break anything. if it isn't called, the autocomplete window is assumed to be up, even though it isn't, and
    // then the shell doesn't receive the correct keystrokes for submitting commands, etc
    var ret = function(list) {
      if (list === undefined) {
        list = [];
      }
      callback({list: list, from: CodeMirror.Pos(cur.line, token.start), to: CodeMirror.Pos(cur.line, token.end)});
    };

    var context = [];
    // TODO: doesn't work with bracket notation (properties or object at index)
    // Theoretically, we should be able to parse any composition of properties, brackets [], (including array indices)
    // Functions, however, we won't try to eval, because those could modify state which we don't want
    // If it is a property, find out what it is a property of.
    while (tprop.type == "property") {
      tprop = editor.getTokenAt(CodeMirror.Pos(cur.line, tprop.start));
      if (tprop.string != ".") return;
      tprop = editor.getTokenAt(CodeMirror.Pos(cur.line, tprop.start));
      context.push(tprop);
    }
    if (context.length === 0) {
      ret();
      return;
    }
    context.reverse();
    var stringToEval = "";
    for (var idx in context) {
      var tok = context[idx];
      stringToEval += tok.string;
      if (idx != context.length - 1) {
        stringToEval += ".";
      }
    }

    try {
      shell.evaluator.eval(stringToEval, function(out, isError){
        if (isError) {
          ret();
          return;
        }
        // check if this is the db object that was the output
        if (out === shell.db) {
          var startsWith = token.string;
          shell.db.getCollectionNames(function(obj){
            var list = $.grep(obj.result, function(name, i) {
              return name.indexOf(startsWith) === 0;
            });

            ret(list);
          });
        }
      });
    } catch (err) {
      // esprima might throw an except when parsing the stringToEval, which means there definitely isn't an
      // autocompletion to do. This would happen for any token that ends in ) or ], since codemirror isn't smart
      // enough to pick these up
      ret();
    }
  };

  CodeMirror.showHint(cm, showCollections, {async: true});
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
    theme: 'solarized dark',
    extraKeys: {"Tab": this.autocomplete.bind(this), "Ctrl-U": function(cm) { cm.setValue(''); }}
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
  this.evaluator.setGlobal('ObjectId', function(oid) {
    return {'$oid': oid};
  });
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
