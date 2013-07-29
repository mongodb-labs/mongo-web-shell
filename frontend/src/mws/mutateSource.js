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

/* global falafel, mongo */
mongo.mutateSource = (function () {
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
    if (node.property.type === 'Identifier' && node.computed === false) {
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

  return {
    swapMemberAccesses: swapMemberAccesses,
  };
}());
