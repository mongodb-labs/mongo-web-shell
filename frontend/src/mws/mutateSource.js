/* global console, falafel, mongo */
mongo.mutateSource = (function () {
  // TODO: Handle WithStatement var hiding. :(
  // TODO: Do LabeledStatements (break & continue) interfere with globals?
  // TODO: Calling an undefined variable results in return value undefined,
  // rather than a reference error.
  var NODE_TYPE_HANDLERS = {
    'FunctionDeclaration': mutateFunctionDeclaration,
    'Identifier': mutateIdentifier,
    'MemberExpression': mutateMemberExpression,
    'VariableDeclaration': mutateVariableDeclaration
  };

  /**
   * Mutates the source of the given FunctionDeclaration node backed by the
   * falafel produced AST. Note that this is for declarations (`function
   * identifier()...`), not expressions (var i = function ()...).
   *
   * Outside of a function, the function declaration is replaced with a
   * function expression with the assigned variable changed to
   * shell.vars.functionIdentifier, avoiding assignment to the global object.
   *
   * Inside of a function, does nothing as the declared function will be bound
   * to the function scope.
   */
  function mutateFunctionDeclaration(node, shellID) {
    // TODO: Handle FunctionDeclaration.: defaults, rest, generator, expression
    if (nodeIsInsideFunction(node)) { return; }

    var objRef = 'mongo.shells[' + shellID + '].vars.' + node.id.name;
    var paramsStr = node.params.map(function (paramNode) {
      return paramNode.source();
    }).join(', ');
    node.update(objRef + ' = function (' + paramsStr + ') ' +
        node.body.source());
  }

  /**
   * Mutates the source of the given Identifier node backed by the falafel
   * produced AST.
   *
   * We hide all global references given to the shell input inside the
   * shell.vars object associated with the shell that evaled the statement.
   * Local references (i.e. declared within functions) are untouched.
   */
  function mutateIdentifier(node, shellID) {
    if (getLocalVariableIdentifiers(node)[node.name]) { return; }

    // Match any expression not of form '...a.iden...'.
    var parent = node.parent;
    if (parent.type === 'MemberExpression' && parent.property === node &&
        parent.computed === false) {
      return;
    }
    // Match any expression not of the form '...{iden: a}...'.
    if (parent.type === 'Property' && parent.key === node) { return; }
    // Match any expression not of the form 'function iden()...' or 'function
    // a(iden)...'.
    if (parent.type === 'FunctionDeclaration' ||
        parent.type === 'FunctionExpression') {
      return;
    }
    // XXX: Match any expression not of the form 'mongo.keyword.evaluate(...)'.
    // The keywords are swapped into the source before the AST walk and are
    // considered to be normal user input during the AST walk. Thus, the call
    // would be replaced as any other but to prevent that, we explicitly
    // reserve the specific CallExpression below.
    if (parent.type === 'MemberExpression' && parent.computed === false) {
      var keywordNode = parent.property;
      var evaluateNode = parent.parent;
      var callNode = evaluateNode.parent;
      if (keywordNode.type === 'Identifier' &&
          keywordNode.name === 'keyword' &&
          evaluateNode.type === 'MemberExpression' &&
          evaluateNode.computed === false &&
          evaluateNode.property.type === 'Identifier' &&
          evaluateNode.property.name === 'evaluate' &&
          callNode.type === 'CallExpression') {
        return;
      }
    }

    node.update('mongo.shells[' + shellID + '].vars.' + node.name);
  }

  /**
   * Mutates the source of the given MemberExpression node backed by the
   * falafel produced AST.
   *
   * We replace any expressions of the form "db.collection" with a new
   * mongo.Query object using the matched identifiers.
   */
  function mutateMemberExpression(node, shellID) {
    // TODO: Resolve db reference in other identifiers.
    var dbNode = node.object, collectionNode = node.property;
    if (dbNode.type !== 'Identifier' || dbNode.name !== 'db') { return; }

    var collectionArg = collectionNode.source();
    if (collectionNode.type === 'Identifier' && !node.computed) {
      // Of the form a.collection; the identifier should be taken as a literal.
      collectionArg = '"' + collectionArg + '"';
    }

    var args = ['mongo.shells[' + shellID + ']', collectionArg].join(', ');
    var oldSrc = node.source();
    node.update('new mongo.Query(' + args + ')');
    console.debug('mutateMemberExpression(): mutated', oldSrc, 'to',
        node.source());
  }

  /**
   * Mutates the source of the given VariableDeclaration node backed by the
   * falafel produced AST.
   *
   * Outside of a function, takes each initialized declaration found in the
   * node and places it within an IIFE (i.e. `var i = 4;` => `(function () {
   * i = 4; }());`). Ordinarily, this would initialize the var to the global
   * object but since we have already replaced the vars used in the shell with
   * 'mongo.shells[id].vars.identifier', these variables will be stored there
   * instead. These IIFEs also return a value of undefined, which mimics
   * `var = ...`.
   *
   * Inside of a function, does nothing. JavaScript is function scoped so
   * identifiers local to a function (i.e. declared) will not be replaced with
   * `mongo...` and to correctly declare these function local vars, the
   * VariableDeclaration node is needed unchanged.
   */
  function mutateVariableDeclaration(node) {
    if (nodeIsInsideFunction(node)) { return; }

    var declarationSrc = node.declarations.map(function (declarationNode) {
      if (declarationNode.init === null) {
        return '';
      }
      return declarationNode.source() + ';';
    }).join(' ');
    var source = '(function () { ' + declarationSrc + ' }())';
    // ForStatement provides it's own ';' outside of this node.
    source += (node.parent.type !== 'ForStatement') ? '; ' : '';
    node.update(source);
  }

  /*
   * Returns an object of {identifier: true} for each non-global identifier
   * found within the scope of the given node. These identifiers are the
   * parameters to, and variables declared, within the containing functions.
   */
  function getLocalVariableIdentifiers(node) {
    var mergeObjects = mongo.util.mergeObjects;
    var identifiers = {};
    var functionNode = getContainingFunctionNode(node);
    while (functionNode !== null) {
      if (functionNode.id !== null) {
        identifiers[functionNode.id.name] = true;
      }
      var paramIdentifiers = extractParamsIdentifiers(functionNode.params);
      identifiers = mergeObjects(identifiers, paramIdentifiers);
      var bodyIdentifiers = extractBodyIdentifiers(functionNode.body);
      identifiers = mergeObjects(identifiers, bodyIdentifiers);

      functionNode = getContainingFunctionNode(functionNode);
    }
    return identifiers;
  }

  /**
   * Returns {identifier: true} for all of the identifiers found in the given
   * FunctionDeclaration.params or FunctionExpression.params.
   */
  function extractParamsIdentifiers(params) {
    var identifiers = {};
    params.forEach(function (paramNode) {
      if (paramNode.type !== 'Identifier') {
        // TODO: Check what other types this can be and handle if relevant.
        console.debug('extractParamsIdentifiers: does not handle ' +
            'paramNode of type', paramNode.type);
        return;
      }
      identifiers[paramNode.name] = true;
    });
    return identifiers;
  }

  /**
   * Returns {identifier: true} for all of the declared identifiers found in
   * the given FunctionDeclaration.body or FunctionExpression.body.
   */
  function extractBodyIdentifiers(body) {
    // TODO: Can the body be anything but BlockStatement?
    if (body.type !== 'BlockStatement') { return; }

    var identifiers = {};
    body.body.forEach(function (statement) {
      if (statement.type !== 'VariableDeclaration') { return; }

      statement.declarations.forEach(function (declaration) {
        if (declaration.type !== 'VariableDeclarator') {
          // TODO: Check what other types this can be and handle if relevant.
          console.debug('extractBodyIdentifiers: does not handle ' +
              'declaration node of type', declaration.type);
          return;
        }
        var identifierNode = declaration.id;
        if (identifierNode.type !== 'Identifier') {
          // TODO: Check what other types this can be and handle if relevant.
          console.debug('extractBodyIdentifiers: does not handle ' +
              'statement node of type', identifierNode.type);
          return;
        }
        identifiers[identifierNode.name] = true;
      });
    });
    return identifiers;
  }

  /**
   * Returns the node of the function that contains the given node, or null if
   * it does not exist.
   */
  function getContainingFunctionNode(node) {
    node = node.parent;
    while (node) {
      if (node.type === 'FunctionDeclaration' ||
          node.type === 'FunctionExpression') {
        return node;
      }
      node = node.parent;
    }
    return null;
  }

  function nodeIsInsideFunction(node) {
    return (getContainingFunctionNode(node) !== null) ? true : false;
  }

  /**
   * Replaces mongo shell specific input (such as the `db.` methods) in the
   * given javascript source with the equivalent mongo web shell calls and
   * returns this mutated source. This transformation allows the code to be
   * interpretted as standard javascript in the context of this html document.
   * Also takes the ID of the shell making the call so the returned code can
   * reference the shell.
   */
  function swapMongoCalls(src, shellID) {
    var output = falafel(src, function (node) {
      if (NODE_TYPE_HANDLERS[node.type]) {
        NODE_TYPE_HANDLERS[node.type](node, shellID);
      }
    });
    return output.toString();
  }

  /**
   * Replaces mongo shell specific keywords (such as "help") in the given
   * source with a valid JavaScript function call that may be evaled and
   * returns this mutated source.
   */
  function swapKeywords(src, shellID) {
    var statements = src.split(/\s*;\s*/);
    statements.forEach(function (statement, index, arr) {
      var tokens = statement.split(/\s+/).filter(function (str) {
        return str.length !== 0;
      });
      if (/help|it|show|use/.test(tokens[0])) {
        arr[index] = convertTokensToKeywordCall(shellID, tokens);
      }
    });
    return statements.join('; ');
  }

  /**
   * Takes an array of tokens and a shellID and returns a string that contains
   * a mongo.keyword call that can be evaled.
   */
  function convertTokensToKeywordCall(shellID, tokens) {
    var tokensAsArgs = tokens.map(function (str) {
      return '\'' + str + '\''; // Pad as string literals.
    });
    var args = [shellID].concat(tokensAsArgs).join(', ');
    var func = 'mongo.keyword.evaluate';
    return func + '(' + args + ')';
  }

  return {
    swapMongoCalls: swapMongoCalls,
    swapKeywords: swapKeywords,

    _mutateFunctionDeclaration: mutateFunctionDeclaration,
    _mutateIdentifier: mutateIdentifier,
    _mutateMemberExpression: mutateMemberExpression,
    _mutateVariableDeclaration: mutateVariableDeclaration,
    _getLocalVariableIdentifiers: getLocalVariableIdentifiers,
    _extractParamsIdentifiers: extractParamsIdentifiers,
    _extractBodyIdentifiers: extractBodyIdentifiers,
    _getContainingFunctionNode: getContainingFunctionNode,
    _nodeIsInsideFunction: nodeIsInsideFunction,
    _convertTokensToKeywordCall: convertTokensToKeywordCall
  };
}());
