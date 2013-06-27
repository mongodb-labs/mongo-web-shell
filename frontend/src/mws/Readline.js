/* global mongo */
mongo.Readline = function (codemirror, submitFunction) {
  this.codemirror = codemirror;
  this.submitFunction = submitFunction;
  if (localStorage){
    this.history = localStorage[mongo.const.shellHistoryKey];
  }
  this.history = this.history ? JSON.parse(this.history) : []; // Newest entries at Array.length
  this.historyIndex = this.history.length;

  this.codemirror.on('keydown', function (codemirror, event) {this.keydown(event);}.bind(this));
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
    this.submit(this.codemirror.getValue());
    break;
  default:
    return;
  }

  event.preventDefault();
  if (line !== undefined && line !== null) {
    this.codemirror.setValue(line);
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
      // TODO: Restore the command first being written.
      return '';
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

  this.historyIndex = Math.max(this.historyIndex - 1, 0);
  return this.history[this.historyIndex];
};

/**
 * Stores the given line to the command history and resets the history index.
 */
mongo.Readline.prototype.submit = function (line) {
  // TODO: Remove old entries if we've hit the limit.
  this.history.push(line);

  if (localStorage){
    var history = localStorage[mongo.const.shellHistoryKey];
    history = history ? JSON.parse(history) : [];
    history.push(line);
    if (history.length > mongo.const.shellHistorySize){
      history.shift();
    }
    localStorage[mongo.const.shellHistoryKey] = JSON.stringify(history);
  }

  this.historyIndex = this.history.length;
  this.submitFunction();
};

mongo.Readline.prototype.moveCursorToEnd = function() {
  var lastLine = this.codemirror.lineCount() - 1;
  var lastChar = this.codemirror.getLine(lastLine).length - 1;
  this.codemirror.setCursor({
    line: lastLine,
    pos: lastChar
  });
};
