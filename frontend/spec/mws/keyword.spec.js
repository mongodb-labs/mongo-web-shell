/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, spyOn */
/* global xit */
describe('The keyword module', function () {
  var mk = mongo.keyword;
  var shellSpy;

  beforeEach(function () {
    shellSpy = jasmine.createSpyObj('Shell', ['insertResponseLine']);
  });

  afterEach(function () {
    shellSpy = null;
  });

  it('switches over which keyword function to call', function () {
    var shellID = 0;
    mongo.shells[shellID] = shellSpy;
    var old;
    var keywords = ['help', 'it', 'show', 'use'];
    keywords.forEach(function (keyword) {
      spyOn(mk, keyword);
      var args = [];
      for (var i = 0; i < 3; i++) {
        mk.evaluate(shellID, keyword, args[0], args[1]);
        expect(mk[keyword]).toHaveBeenCalledWith(shellSpy, args[0], args[1]);
        expect(mk[keyword].calls.length).toBe(i + 1);
        args.push(0);
      }

      // unusedArg.
      switch (keyword) {
      case 'help':
      case 'show':
        old = {
          insert: shellSpy.insertResponseLine.calls.length,
          keyword: mk[keyword].calls.length
        };
        mk.evaluate(shellID, keyword, args[0], args[1], args[2]);
        expect(shellSpy.insertResponseLine.calls.length).toBe(old.insert + 1);
        expect(mk[keyword].calls.length).toBe(old.keyword);
        break;

      case 'it':
      case 'use':
        old = mk[keyword].calls.length;
        mk.evaluate(shellID, keyword, args[0], args[1], args[2]);
        expect(mk[keyword].calls.length).toBe(old + 1);
        break;
      }
    });

    // Bad keyword.
    old = {};
    keywords.forEach(function (keyword) {
      old[keyword] = mk[keyword].calls.length;
    });
    old._insert = shellSpy.insertResponseLine.calls.length;
    mk.evaluate(shellID, 'bad_keyword');
    expect(shellSpy.insertResponseLine.calls.length).toBe(old._insert + 1);
    keywords.forEach(function (keyword) {
      expect(mk[keyword].calls.length).toBe(old[keyword]);
    });
  });

  xit('mongo.keyword.help', function () {
    // TODO: Implement this when the function is implemented.
  });

  it('prints a batch from the last used cursor', function () {
    var hasNext;
    var cursorSpy = jasmine.createSpyObj('Cursor', ['hasNext', '_printBatch']);
    cursorSpy.hasNext.andCallFake(function () { return hasNext; });

    shellSpy.lastUsedCursor = null;
    mk.it(shellSpy);
    expect(shellSpy.insertResponseLine).toHaveBeenCalled();

    shellSpy.lastUsedCursor = cursorSpy;
    hasNext = false;
    mk.it(shellSpy);
    expect(shellSpy.insertResponseLine.calls.length).toBe(2);

    hasNext = true;
    mk.it(shellSpy);
    expect(cursorSpy._printBatch).toHaveBeenCalled();
  });

  it('mongo.keyword.show', function () {
    spyOn(mongo.request, 'dbGetCollectionNames');

    mongo.config = {baseURL: 'test_url'};

    mongo.keyword.show(shellSpy, 'doesNotExist');
    expect(shellSpy.insertResponseLine).toHaveBeenCalledWith('ERROR: Not yet implemented');

    mongo.keyword.show(shellSpy, 'collections');
    expect(mongo.request.dbGetCollectionNames).toHaveBeenCalled();
  });

  it('warns the user that the "use" keyword is disabled', function () {
    var args = [];
    for (var i = 0; i < 3; i++) {
      mk.use(shellSpy, args[0], args[1]);
      expect(shellSpy.insertResponseLine.calls.length).toBe(i + 1);
      args.push(i);
    }
  });
});
