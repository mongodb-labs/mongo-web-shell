/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, spyOn, sinon */
describe('The keyword module', function () {
  var mk = mongo.keyword;
  var shellSpy;

  beforeEach(function () {
    shellSpy = jasmine.createSpyObj('Shell', ['insertResponseLine', 'insertResponseArray']);
  });

  afterEach(function () {
    shellSpy = null;
  });

  describe('when parsing source', function () {
    var shell = {};

    it('returns whether or not the source is a keyword expression', function () {
      var wasKeyword = mongo.keyword.handleKeywords(shell, 'this.is = not.a.keyword');
      expect(wasKeyword).toBe(false);

      spyOn(mongo.keyword, 'it');
      wasKeyword = mongo.keyword.handleKeywords(shell, 'it is a keyword');
      expect(wasKeyword).toBe(true);
    });

    it('calls the appropriate keyword function', function () {
      mongo.keyword.myAwesomeKeyword = jasmine.createSpy('my keyword');
      mongo.keyword.handleKeywords(shell, 'myAwesomeKeyword foo bar');
      expect(mongo.keyword.myAwesomeKeyword).toHaveBeenCalledWith(shell, ['foo', 'bar']);
    });
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

  describe('the show keyword', function () {
    beforeEach(function () {
      shellSpy.db = {getCollectionNames: jasmine.createSpy('getCollectionNames')};
    });

    it('handles unimplemented arguments', function () {
      mongo.keyword.show(shellSpy, ['doesNotExist']);
      expect(shellSpy.insertResponseLine).toHaveBeenCalledWith('ERROR: Not yet implemented');
    });

    it('can list collections', function () {
      mongo.keyword.show(shellSpy, ['collections']);
      expect(shellSpy.db.getCollectionNames.calls.length).toEqual(1);
      var callback = shellSpy.db.getCollectionNames.calls[0].args[0];
      var r = {result: ['a', 'b', 'c']};
      callback(r);
      expect(shellSpy.insertResponseLine.calls.length).toEqual(3);
      expect(shellSpy.insertResponseLine.calls[0].args).toEqual(['a']);
      expect(shellSpy.insertResponseLine.calls[1].args).toEqual(['b']);
      expect(shellSpy.insertResponseLine.calls[2].args).toEqual(['c']);
    });

    it('can list tables', function () {
      mongo.keyword.show(shellSpy, ['tables']);
      expect(shellSpy.db.getCollectionNames.calls.length).toEqual(1);
      var callback = shellSpy.db.getCollectionNames.calls[0].args[0];
      var r = {result: ['a', 'b', 'c']};
      callback(r);
      expect(shellSpy.insertResponseLine.calls.length).toEqual(3);
      expect(shellSpy.insertResponseLine.calls[0].args).toEqual(['a']);
      expect(shellSpy.insertResponseLine.calls[1].args).toEqual(['b']);
      expect(shellSpy.insertResponseLine.calls[2].args).toEqual(['c']);
    });

    it('requires at least one argument', function () {
      var message = 'ERROR: show requires at least one argument';
      mongo.keyword.show(shellSpy, []);
      expect(shellSpy.insertResponseLine.calls.length).toBe(1);
      expect(shellSpy.insertResponseLine).toHaveBeenCalledWith(message);
    });
  });

  it('warns the user that the "use" keyword is disabled', function () {
    var message = 'Cannot change db: functionality disabled.';
    mk.use(shellSpy);
    expect(shellSpy.insertResponseLine).toHaveBeenCalledWith(message);
  });

  describe('the reset keyword', function(){
    beforeEach(function(){
      shellSpy.readline = jasmine.createSpyObj('Readline', ['getLastCommand']);
      shellSpy.readline.getLastCommand.andReturn('not reset');
      mongo.keyword._resetHasBeenCalled = false;
    });

    it('requires confirmation on first run', function(){
      spyOn(mongo.request, 'makeRequest');
      shellSpy.readline.getLastCommand.andReturn('reset');
      mongo.keyword.reset(shellSpy);
      expect(mongo.request.makeRequest).not.toHaveBeenCalled();
    });

    it('confirms before reset', function(){
      spyOn(mongo.request, 'makeRequest');
      shellSpy.readline.getLastCommand.andReturn('not reset');
      mongo.keyword.reset(shellSpy);
      expect(mongo.request.makeRequest).not.toHaveBeenCalled();
    });

    describe('assuming the reset is confirmed', function(){
      var xhr, requests = [];

      beforeEach(function(){
        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = function (xhr) { requests.push(xhr); };

        shellSpy.readline.getLastCommand.andReturn('reset');
        mongo.config = {baseUrl: '/test_url/'};
        shellSpy.mwsResourceID = 'test_res_id';
        mongo.keyword.reset(shellSpy);
      });

      afterEach(function () {
        xhr.restore();
      });

      it('drops the database', function(){
        var makeRequest = spyOn(mongo.request, 'makeRequest');
        mongo.keyword.reset(shellSpy);
        expect(makeRequest.calls[0].args[0]).toEqual('/test_url/test_res_id/db');
        expect(makeRequest.calls[0].args[2]).toEqual('DELETE');
        expect(makeRequest.calls[0].args[4]).toBe(shellSpy);
      });

      it('runs the initialization scripts', function(){
        spyOn(mongo.init, '_initShell');

        mongo.keyword.reset(shellSpy);
        requests[0].respond(204);
        expect(mongo.init._initShell.callCount).toBe(mongo.shells.length);
      });

      it('requires confirmation to reset again immediately', function () {
        var makeRequest = spyOn(mongo.request, 'makeRequest');
        // Already confirmed, should be called
        mongo.keyword.reset(shellSpy);
        expect(makeRequest.calls.length).toEqual(1);

        // Re-resetting, should re-confirm
        mongo.keyword.reset(shellSpy);
        expect(makeRequest.calls.length).toEqual(1);
        mongo.keyword.reset(shellSpy);
        expect(makeRequest.calls.length).toEqual(2);
      });
    });
  });

  describe('the help keyword', function(){
    it('prints out the help message', function(){
      mongo.keyword.help(shellSpy);
      expect(shellSpy.insertResponseArray).toHaveBeenCalled();
    });
  });

});
