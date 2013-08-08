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

/* global describe, expect, it, mongo */
describe('The mutateSource module', function () {
  it('replaces object field reads with a getter function', function () {
    var source = 'a.foo + 1; foo[bar()]["baz"]';
    var mutated = mongo.mutateSource.swapMemberAccesses(source);

    var expected = '__get(a, "foo") + 1; __get(__get(foo, bar()), "baz")';
    expect(mutated).toEqual(expected);
  });

  it('doesn\'t wrap bracketed identifiers in quotes', function () {
    var source = 'i = 0; a[i];';
    var mutated = mongo.mutateSource.swapMemberAccesses(source);

    var expected = 'i = 0; __get(a, i);';
    expect(mutated).toEqual(expected);
  });

  it('doesn\'t change object field writes', function () {
    var source = 'a.foo = a.foo; foo.bar.baz = "hello"';
    var mutated = mongo.mutateSource.swapMemberAccesses(source);

    var expected = 'a.foo = __get(a, "foo"); __get(foo, "bar").baz = "hello"';
    expect(mutated).toEqual(expected);
  });
});
