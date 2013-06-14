/* global jasmin */
describe('The DB class', function () {
  var db;
  beforeEach(function () {
    db = new mongo.DB({}, 'testdb');
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
});