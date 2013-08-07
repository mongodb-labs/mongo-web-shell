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
mongo.Readline = function ($input) {
  this.$input = $input;
  if (localStorage){
    this.history = localStorage[mongo.config.shellHistoryKey];
  }
  this.history = this.history ? JSON.parse(this.history) : []; // Newest entries at Array.length
  this.historyIndex = this.history.length;
  this.historyFirstCommand = '';

  var readline = this;
  this.$input.keydown(function (event) { readline.keydown(event); });
};

mongo.Readline.prototype.keydown = function (event) {
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
    this.submit(this.$input.val());
    break;
  default:
    return;
  }

  if (line !== undefined && line !== null) {
    this.$input.val(line);
    this.moveCursorToEnd();
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
    this.historyFirstCommand = this.$input.val();
  }

  this.historyIndex = Math.max(this.historyIndex - 1, 0);
  return this.history[this.historyIndex];
};

/**
 * Stores the given line to the command history and resets the history index.
 */
mongo.Readline.prototype.submit = function (line) {
  // ignore blank lines
  if (line.match(/^\s*$/)){ return; }

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
};

mongo.Readline.prototype.moveCursorToEnd = function() {
  var $inp = this.$input;
  var inp = $inp.get(0);

  // This needs to happen after the key event finishes dispatching
  setTimeout(function () {
    // Taken from: http://stackoverflow.com/a/1675345
    if (inp.setSelectionRange) {
      // Use function if it exists.
      // (Doesn't work in IE)

      // Double the length because Opera is inconsistent about whether a
      // carriage return is one character or two.
      var len = $inp.val().length * 2;
      inp.setSelectionRange(len, len);
    } else {
      // Otherwise use workaround.
      // (Doesn't work in Google Chrome)
      $inp.val($inp.val());
    }
  }, 0);
};

mongo.Readline.prototype.getLastCommand = function(){
  // By the time our code is able to call this function, we will already have
  // added the current command to the history, which we want to ignore.
  return this.history[this.history.length - 2];
};
