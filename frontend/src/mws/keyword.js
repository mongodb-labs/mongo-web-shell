/* global console, mongo */
mongo.keyword = (function () {
  function handleKeywords(shell, src) {
    var tokens = src.split(/\s+/).filter(function (str) {
      return str.length !== 0;
    });
    var func = tokens[0];
    var args = tokens.slice(1);
    if (mongo.keyword[func]) {
      mongo.keyword[func](shell, args);
      return true;
    }
    return false;
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

  function show(shell, args) {
    if (args.length === 0) {
      shell.insertResponseLine('ERROR: show requires at least one argument');
      return;
    }
    var subject = args[0];
    switch (subject) {
    case 'tables':
      /* falls through */
    case 'collections':
      shell.db.getCollectionNames(function (r) {
        $(r.result).each(function (i, e) {
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
    handleKeywords: handleKeywords,
    it: it,
    show: show,
    use: use
  };
}());
