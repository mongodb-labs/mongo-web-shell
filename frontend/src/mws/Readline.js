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

/* global mongo */
mongo.Readline = function (codemirror, submitFunction) {
  this.inputBox = codemirror;
  this.submitFunction = submitFunction;
  if (localStorage){
    this.history = localStorage[mongo.config.shellHistoryKey];
  }
  this.history = this.history ? JSON.parse(this.history) : []; // Newest entries at Array.length
  this.historyIndex = this.history.length;
  this.historyFirstCommand = '';

  this.inputBox.on('keydown', function (codemirror, event) {this.keydown(event);}.bind(this));
};

mongo.Readline.prototype.keydown = function (event) {
  //TODO: if typing of letters occurs with the autocomplete open, it should close it
  // check if the autocomplete window is open, if it is, just return, that gets priority
  if (this.inputBox.state.completionActive) {
    return;
  }
  var key = mongo.config.keycodes;
  var line;
  switch (event.keyCode) {
    case key.up:
      line = this.getOlderHistoryEntry();
      break;
    case key.down:
      line = this.getNewerHistoryEntry();
      break;
    case key.enter:
      this.submit(this.inputBox.getValue());
      break;
    default:
      return;
  }

  if (line !== undefined && line !== null) {
    this.inputBox.setValue(line);
    this.moveCursorToEnd();
  }
  if (event.preventDefault) {
    event.preventDefault();
  } else {
    // IE8
    event.returnValue = false;
  }
};

/**
 * Returns a more recent line from the stored command history. The most recent
 * line returned is the empty string and after that is returned, subsequent
 * calls to this method without resetting or traversing the history will return
 * undefined. A call to this method when the history is empty will return
 * undefined.
 */
mongo.Readline.prototype.getNewerHistoryEntry = function () {
  if (this.history.length === 0) { return undefined; }

  var old = this.historyIndex;
  this.historyIndex = Math.min(this.historyIndex + 1, this.history.length);
  if (this.historyIndex === this.history.length) {
    if (old !== this.historyIndex) {
      return this.historyFirstCommand;
    }
    return undefined;
  }
  return this.history[this.historyIndex];
};

/**
 * Returns a less recent line from the stored command history. If the least
 * recent command is returned, subsequent calls to this method without
 * resetting or traversing the history will return this same command. A call to
 * this method when the history is empty will return undefined.
 */
mongo.Readline.prototype.getOlderHistoryEntry = function () {
  if (this.history.length === 0) { return undefined; }

  if (this.historyIndex === this.history.length) {
    this.historyFirstCommand = this.inputBox.getValue();
  }

  this.historyIndex = Math.max(this.historyIndex - 1, 0);
  return this.history[this.historyIndex];
};

/**
 * Stores the given line to the command history and resets the history index.
 */
mongo.Readline.prototype.submit = function (line) {

  this.history.push(line);

  if (localStorage){
    var history = localStorage[mongo.config.shellHistoryKey];
    history = history ? JSON.parse(history) : [];
    history.push(line);
    if (history.length > mongo.config.shellHistorySize){
      history.shift();
    }
    localStorage[mongo.config.shellHistoryKey] = JSON.stringify(history);
  }

  this.historyIndex = this.history.length;
  this.submitFunction();
};

mongo.Readline.prototype.moveCursorToEnd = function() {
  var lastLine = this.inputBox.lineCount() - 1;
  var lastChar = this.inputBox.getLine(lastLine).length - 1;
  this.inputBox.setCursor({
    line: lastLine,
    pos: lastChar
  });
};

mongo.Readline.prototype.getLastCommand = function(){
  // By the time our code is able to call this function, we will already have
  // added the current command to the history, which we want to ignore.
  return this.history[this.history.length - 2];
};
