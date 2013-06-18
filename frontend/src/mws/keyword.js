// TODO: Remove unused once help and show are implemented.
/* jshint unused: false */
/* global console, mongo */
mongo.keyword = (function () {
  function evaluate(shellID, keyword, arg, arg2, unusedArg) {
    var shell = mongo.shells[shellID];
    switch (keyword) {
    case 'help':
    case 'show':
      if (unusedArg !== undefined) {
        shell.insertResponseLine('Too many parameters to ' + keyword + '.');
        console.debug('Too many parameters to', keyword + '.');
        return;
      }
      break;

    case 'it': // 'it' ignores other arguments.
    case 'use': // 'use' is disabled so the arguments don't matter.
      break;

    default:
      shell.insertResponseLine('Unknown keyword: ' + keyword + '.');
      console.debug('Unknown keyword', keyword);
      return;
    }
    mongo.keyword[keyword](shell, arg, arg2);
  }

  function help(shell, arg, arg2) {
    // TODO: Implement.
    console.debug('keyword.help called.');
  }

  function it(shell) {
    var cursor = shell.lastUsedCursor;
    if (cursor && cursor.hasNext()) {
      cursor._printBatch();
      return;
    }
    shell.insertResponseLine('no cursor');
    console.warn('no cursor');
  }

  function show(shell, subject) {
    switch (subject){
    case 'collections':
      mongo.request.dbGetCollectionNames(shell, function(r){
        $(r.result).each(function(i, e){
          shell.insertResponseLine(e);
        });
      });
      break;
    default:
      shell.insertResponseLine('ERROR: Not yet implemented');
    }
  }

  function use(shell) {
    console.debug('cannot change db: functionality disabled.');
    shell.insertResponseLine('Cannot change db: functionality disabled.');
  }

  return {
    evaluate: evaluate,
    help: help,
    it: it,
    show: show,
    use: use
  };
}());
