/* global console, falafel, mongo */
mongo.mutateSource = (function () {
  // TODO: Handle WithStatement var hiding. :(
  // TODO: Do LabeledStatements (break & continue) interfere with globals?

  /**
   * Mutates the source of the given MemberExpression node backed by the
   * falafel produced AST.
   *
   * We replace all reads to allow support for __methodMissing__
   */
  function mutateMemberExpression(node) {
    // Only convert reads, not writes
    if (node.parent.type === 'UpdateExpression' || (
          node.parent.type === 'AssignmentExpression' &&
          node.parent.left === node)) {
      return;
    }
    var objSource = node.object.source();
    var propSource = node.property.source();
    // Since we're going to be using the a['b'] syntax,
    // we need to wrap identifier properties in quotes.
    if (node.property.type === 'Identifier') {
      propSource = '"' + propSource + '"';
    }

    var newSource = '(function (obj, field) {' +
        'return (field in obj || !("__methodMissing__" in obj) ' +
          '? obj[field] : obj.__methodMissing__(field) )' +
      '})(' + objSource + ', ' + propSource + ')';
    node.update(newSource);

  }

  /**
   * Replaces mongo shell specific input (such as the `db.` methods) in the
   * given javascript source with the equivalent mongo web shell calls and
   * returns this mutated source. This transformation allows the code to be
   * interpretted as standard javascript in the context of this html document.
   * Also takes the ID of the shell making the call so the returned code can
   * reference the shell.
   */
  function swapMongoCalls(src) {
    var output = falafel(src, function (node) {
      if (node.type === 'MemberExpression') {
        mutateMemberExpression(node);
      }
    });
    return output.toString();
  }

  /**
   * Replaces mongo shell specific keywords (such as "help") in the given
   * source with a valid JavaScript function call that may be evaled and
   * returns this mutated source.
   */
  function swapKeywords(src) {
    var statements = src.split(/\s*;\s*/);
    statements.forEach(function (statement, index, arr) {
      var tokens = statement.split(/\s+/).filter(function (str) {
        return str.length !== 0;
      });
      if (/help|it|show|use/.test(tokens[0])) {
        arr[index] = convertTokensToKeywordCall(tokens);
      }
    });
    return statements.join('; ');
  }

  /**
   * Takes an array of tokens and returns a string that contains
   * a call to the appropriate method on db that can be evaled.
   */
  function convertTokensToKeywordCall(tokens) {
    var func = tokens[0];
    var args = tokens.slice(1);
    args = args.map(function (str) {
      return '"' + str + '"';
    });
    return 'db.' + func + '(' + args.join(', ') + ')';
  }

  return {
    swapMongoCalls: swapMongoCalls,
    swapKeywords: swapKeywords,

    _mutateMemberExpression: mutateMemberExpression,
    _convertTokensToKeywordCall: convertTokensToKeywordCall
  };
}());
