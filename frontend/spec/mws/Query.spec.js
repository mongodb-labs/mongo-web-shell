/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, spyOn */
describe('A Query', function () {
  var instance, shellSpy, collectionName, requestStore;

  beforeEach(function () {
    requestStore = mongo.request;
    mongo.request = jasmine.createSpyObj('request', ['dbCollectionFind',
        'dbCollectionInsert']);
    spyOn(mongo, 'Cursor').andCallThrough();

    shellSpy = jasmine.createSpy('shell');
    collectionName = 'collectionName';
    instance = new mongo.Query(shellSpy, collectionName);
  });

  afterEach(function () {
    mongo.request = requestStore;
    requestStore = null;
  });

  it('can return a Cursor for finding within a collection', function () {
    var query = '{iu: "jjang"}', projection = '{_id: 0}';
    var args = {query: query, projection: projection};
    var actual = instance.find(query, projection);
    expect(mongo.Cursor).toHaveBeenCalledWith(instance,
        mongo.request.dbCollectionFind, args);
    expect(actual).toEqual(jasmine.any(mongo.Cursor));
    expect(mongo.request.dbCollectionFind).not.toHaveBeenCalled();
  });

  it('can make a request to insert into a collection', function () {
    var doc = '{iu: "jjang"}';
    instance.insert(doc);
    expect(mongo.request.dbCollectionInsert).toHaveBeenCalledWith(instance,
        doc);
  });
});
