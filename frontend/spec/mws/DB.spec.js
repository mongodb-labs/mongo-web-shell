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