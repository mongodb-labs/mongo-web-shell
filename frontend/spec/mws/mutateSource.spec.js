/* global describe, expect, it, mongo */
describe('The mutateSource module', function () {
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
});
