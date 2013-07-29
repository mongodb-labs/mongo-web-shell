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

/* global describe, it, beforeEach, mongo, spyOn, expect, jasmine */
describe('The DB class', function () {
  var db;
  beforeEach(function () {
    spyOn(mongo.util, 'getDBResURL').andReturn('/test/url');
    var shell = {
      insertResponseLine: jasmine.createSpy('insertResponseLine')
    };
    db = new mongo.DB(shell, 'testdb');
  });

  it('saves the name and shell', function () {
    var name = 'mydb';
    var shell = {};
    var db = new mongo.DB(shell, name);
    expect(db.name).toEqual(name);
    expect(db.shell).toBe(shell);
  });

  it('has a nice string representation', function () {
    db.name = 'mydb';
    expect(db.toString()).toEqual('mydb');
  });

  it('uses method missing to create collections', function () {
    var referenceCollection = {name: 'refcoll'};
    spyOn(mongo, 'Coll').andReturn(referenceCollection);

    var coll = db.__methodMissing('testcoll');
    expect(coll).toBe(referenceCollection);
    expect(db.testcoll).toBe(coll);
  });

  describe('showing collection names', function () {
    var makeRequest;

    beforeEach(function () {
      makeRequest = spyOn(mongo.request, 'makeRequest');
    });

    it('constructs and uses the db url', function () {
      var shell = {mwsResourceID: 'my_res_id'};
      var url = '/my/test/url';
      mongo.util.getDBResURL.andReturn(url);
      db.shell = shell;

      db.getCollectionNames();
      expect(mongo.util.getDBResURL).toHaveBeenCalledWith('my_res_id');
      expect(makeRequest.calls[0].args[0]).toEqual(url + 'getCollectionNames');
    });

    it('doesn\'t pass in HTTP params', function () {
      db.getCollectionNames();
      expect(makeRequest.calls[0].args[1]).toBeUndefined();
    });

    it('uses the get HTTP method', function () {
      db.getCollectionNames();
      expect(makeRequest.calls[0].args[2]).toEqual('GET');
    });

    it('uses the db\'s shell', function () {
      db.getCollectionNames();
      expect(makeRequest.calls[0].args[4]).toBe(db.shell);
    });

    it('passes the callback through', function () {
      var callback = function () {return 'my callback';};
      db.getCollectionNames(callback);
      expect(makeRequest.calls[0].args[5]).toBe(callback);
    });
  });
});