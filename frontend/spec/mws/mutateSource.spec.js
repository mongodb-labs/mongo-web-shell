/* global describe, expect, it, mongo */
describe('The mutateSource module', function () {
  var ms = mongo.mutateSource;

  it('replaces object field reads with a getter function', function () {
    var source = 'a.foo + 1; foo[bar()]["baz"]';
    var mutated = mongo.mutateSource.swapMemberAccesses(source);

    var expected = '__get(a, "foo") + 1; __get(__get(foo, bar()), "baz")';
    expect(mutated).toEqual(expected);
  });

  it('doesn\'t change object field writes', function () {
    var source = 'a.foo = a.foo; foo.bar.baz = "hello"';
    var mutated = mongo.mutateSource.swapMemberAccesses(source);

    var expected = 'a.foo = __get(a, "foo"); __get(foo, "bar").baz = "hello"';
    expect(mutated).toEqual(expected);
  });

  // Todo: Decide what you're doing and then rewrite this test
  it('replaces keywords with valid JavaScript calls', function () {
    var source = [
      'help', 'it', 'show', 'use',
      'help arg1',
      'help arg1 arg2',
      'help arg1 arg2 unusedArg',
      'not a keyword'
    ].join('; ');
    var expected = [
      'db.help()', 'db.it()', 'db.show()', 'db.use()',
      'db.help("arg1")',
      'db.help("arg1", "arg2")',
      'db.help("arg1", "arg2", "unusedArg")',
      'not a keyword'
    ].join('; ').replace(/\s+/g, '');
    var actual = ms.swapKeywords(source).replace(/\s+/g, '');
    expect(actual).toEqual(expected);
  });

  // Todo: See note on previous test
  it('converts the given tokens into a mongo.keyword call', function () {
    var tokens = ['one', 'two', 'three'];
    var expected = 'db.one("two", "three")';
    var actual = ms._convertTokensToKeywordCall(tokens);
    expect(actual).toEqual(expected);
  });
});
