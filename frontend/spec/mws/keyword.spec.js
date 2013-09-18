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

/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, spyOn, sinon */
describe('The keyword module', function () {
  var mk = mongo.keyword;
  var shell;

  beforeEach(function () {
    shell = new mongo.Shell($('<div></div>'), 0);
    spyOn(shell, 'insertResponseLine');
    spyOn(shell, 'insertResponseArray');
  });

  describe('when parsing source', function () {
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
    var cursor = new mongo.Cursor({shell: shell});
    spyOn(cursor, '_printBatch').andCallThrough();
    cursor._executed = true;
    cursor._storeQueryResult(['foo']);

    shell.lastUsedCursor = null;
    mk.it(shell);
    expect(shell.insertResponseLine).toHaveBeenCalledWith('no cursor');

    shell.lastUsedCursor = cursor;
    expect(cursor._printBatch).not.toHaveBeenCalled();
    mk.it(shell);
    expect(cursor._printBatch).toHaveBeenCalled();

    shell.insertResponseLine.reset();
    mk.it(shell);
    expect(shell.insertResponseLine).toHaveBeenCalledWith('no cursor');

  });

  describe('the show keyword', function () {
    beforeEach(function () {
      shell.db = {getCollectionNames: jasmine.createSpy('getCollectionNames')};
    });

    it('handles unimplemented arguments', function () {
      mongo.keyword.show(shell, ['doesNotExist']);
      expect(shell.insertResponseLine).toHaveBeenCalledWith('ERROR: Not yet implemented');
    });

    it('can list collections', function () {
      mongo.keyword.show(shell, ['collections']);
      expect(shell.db.getCollectionNames.calls.length).toEqual(1);
      var callback = shell.db.getCollectionNames.calls[0].args[0];
      var r = {result: ['a', 'b', 'c']};
      callback(r);
      expect(shell.insertResponseLine.calls.length).toEqual(3);
      expect(shell.insertResponseLine.calls[0].args).toEqual(['a']);
      expect(shell.insertResponseLine.calls[1].args).toEqual(['b']);
      expect(shell.insertResponseLine.calls[2].args).toEqual(['c']);
    });

    it('can list tables', function () {
      mongo.keyword.show(shell, ['tables']);
      expect(shell.db.getCollectionNames.calls.length).toEqual(1);
      var callback = shell.db.getCollectionNames.calls[0].args[0];
      var r = {result: ['a', 'b', 'c']};
      callback(r);
      expect(shell.insertResponseLine.calls.length).toEqual(3);
      expect(shell.insertResponseLine.calls[0].args).toEqual(['a']);
      expect(shell.insertResponseLine.calls[1].args).toEqual(['b']);
      expect(shell.insertResponseLine.calls[2].args).toEqual(['c']);
    });

    it('requires at least one argument', function () {
      var message = 'ERROR: show requires at least one argument';
      mongo.keyword.show(shell, []);
      expect(shell.insertResponseLine.calls.length).toBe(1);
      expect(shell.insertResponseLine).toHaveBeenCalledWith(message);
    });
  });

  it('warns the user that the "use" keyword is disabled', function () {
    var message = 'Cannot change db: functionality disabled.';
    mk.use(shell);
    expect(shell.insertResponseLine).toHaveBeenCalledWith(message);
  });

  describe('the reset keyword', function(){
    beforeEach(function(){
      shell.readline = jasmine.createSpyObj('Readline', ['getLastCommand']);
      shell.readline.getLastCommand.andReturn('not reset');
      mongo.keyword._resetHasBeenCalled = false;
    });

    it('requires confirmation on first run', function(){
      spyOn(mongo.request, 'makeRequest');
      shell.readline.getLastCommand.andReturn('reset');
      mongo.keyword.reset(shell);
      expect(mongo.request.makeRequest).not.toHaveBeenCalled();
    });

    it('confirms before reset', function(){
      spyOn(mongo.request, 'makeRequest');
      shell.readline.getLastCommand.andReturn('not reset');
      mongo.keyword.reset(shell);
      expect(mongo.request.makeRequest).not.toHaveBeenCalled();
    });

    describe('assuming the reset is confirmed', function(){
      var xhr, requests = [];

      beforeEach(function(){
        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = function (xhr) { requests.push(xhr); };

        shell.readline.getLastCommand.andReturn('reset');
        mongo.config = {baseUrl: '/test_url/'};
        shell.mwsResourceID = 'test_res_id';
        mongo.keyword.reset(shell);
      });

      afterEach(function () {
        xhr.restore();
      });

      it('drops the database', function(){
        var makeRequest = spyOn(mongo.request, 'makeRequest');
        mongo.keyword.reset(shell);
        expect(makeRequest.calls[0].args[0]).toEqual('/test_url/test_res_id/db');
        expect(makeRequest.calls[0].args[2]).toEqual('DELETE');
        expect(makeRequest.calls[0].args[4]).toBe(shell);
      });

      it('runs the initialization scripts', function(){
        spyOn(mongo.init, 'runInitializationScripts');

        mongo.keyword.reset(shell);
        requests[0].respond(204);
        expect(mongo.init.runInitializationScripts).toHaveBeenCalled();
      });

      it('requires confirmation to reset again immediately', function () {
        var makeRequest = spyOn(mongo.request, 'makeRequest');
        // Already confirmed, should be called
        mongo.keyword.reset(shell);
        expect(makeRequest.calls.length).toEqual(1);

        // Re-resetting, should re-confirm
        mongo.keyword.reset(shell);
        expect(makeRequest.calls.length).toEqual(1);
        mongo.keyword.reset(shell);
        expect(makeRequest.calls.length).toEqual(2);
      });
    });
  });

  describe('the help keyword', function(){
    it('prints out the help message', function(){
      mongo.keyword.help(shell);
      expect(shell.insertResponseLine).toHaveBeenCalled();
    });
  });

});
