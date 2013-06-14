/* global falafel, mongo */
mongo.mutateSource = (function () {
  // TODO: Handle WithStatement var hiding. :(
  // TODO: Do LabeledStatements (break & continue) interfere with globals?

  /**
   * Mutates the source of the given MemberExpression node backed by the
   * falafel produced AST.
   *
   * We replace all reads with a membership accessor to allow support
   * for __methodMissing
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

    var newSource = '__get(' + objSource + ', ' + propSource + ')';
    node.update(newSource);

  }

  /**
   * Replaces accesses of members of Javascript objects with a call to the
   * accessor '__get'. This allows objects to define a '__methodMissing'
   * function that gets called when trying to access a member that doesn't
   * exist.
   */
  function swapMemberAccesses(src) {
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
    // Todo: To make this more like the shell (and easier) we could not allow
    // the keyword calls to be mixed in with valid Javascript
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
    swapMongoCalls: swapMemberAccesses,
    swapKeywords: swapKeywords,

    _mutateMemberExpression: mutateMemberExpression,
    _convertTokensToKeywordCall: convertTokensToKeywordCall
  };
}());
