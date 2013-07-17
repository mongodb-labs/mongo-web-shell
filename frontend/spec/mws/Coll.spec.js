/* global describe, it, beforeEach, mongo, spyOn, expect, jasmine */
/* jshint camelcase: false */
describe('The Collection class', function () {
  var name_, db_, coll, makeRequest;

  beforeEach(function () {
    spyOn(mongo.util, 'getDBCollectionResURL').andReturn('test_db_url');
    spyOn(mongo.request, 'makeRequest');
    makeRequest = mongo.request.makeRequest;

    name_ = 'test collection';
    db_ = {
      shell: {
        mwsResourceID: 'test res id',
        insertResponseLine: function () {}
      }
    };
    coll = new mongo.Coll(db_, name_);
  });

  it('has a nice string representation', function () {
    var db = db_;
    db.toString = function () { return 'mydb'; };
    var name = 'mycollection';
    var coll = new mongo.Coll(db, name);
    expect(coll.toString()).toEqual('mydb.mycollection');
  });

  describe('making a new collection', function () {
    it('initializes the name, db, and shell', function () {
      var db = {shell: 'test shell'};
      var name = 'test collection';
      var myColl = new mongo.Coll(db, name);
      expect(myColl.name).toEqual(name);
      expect(myColl.db).toBe(db);
      expect(myColl.shell).toEqual(db.shell);
    });

    it('constructs the url for the collection', function () {
      mongo.util.getDBCollectionResURL.andReturn('test_db_url');
      var resId = 'my res id';
      var db = {
        shell: {mwsResourceID: resId}
      };
      var name = 'test collection';
      var coll = new mongo.Coll(db, name);
      expect(mongo.util.getDBCollectionResURL).toHaveBeenCalledWith(resId, name);
      expect(coll.urlBase).toEqual('test_db_url');
    });
  });

  describe('find', function () {
    it('returns a cursor', function () {
      spyOn(mongo, 'Cursor').andCallThrough();
      var query = {foo: 'bar'};
      var projection = {baz: 'garply'};
      var cursor = coll.find(query, projection);
      expect(mongo.Cursor.calls.length).toEqual(1);
      expect(mongo.Cursor).toHaveBeenCalledWith(coll, query, projection);
      expect(cursor instanceof mongo.Cursor).toBe(true);
    });
  });

  describe('findOne', function () {
    var cursor;
    beforeEach(function () {
      cursor = {
        next: jasmine.createSpy(),
        hasNext: jasmine.createSpy().andReturn(true),
        limit: jasmine.createSpy()
      };
      cursor.limit.andReturn(cursor);
      spyOn(coll, 'find').andReturn(cursor);
    });

    it('runs a query limiting to a single result', function () {
      var query = {name: 'Mal Reynolds'};
      var projection = {_id: 0, rank: 1};
      coll.findOne(query, projection);

      expect(coll.find).toHaveBeenCalledWith(query, projection);
      expect(cursor.limit).toHaveBeenCalledWith(1);
    });

    it('returns the found value', function () {
      var value = 'my value';
      cursor.next.andReturn(value);
      expect(coll.findOne()).toEqual(value);
    });

    it('returns null if there are no values', function () {
      cursor.hasNext.andReturn(false);
      expect(coll.findOne()).toBeNull();
    });
  });

  describe('insert', function () {
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.insert({});
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/insert');
    });

    it('constructs appropriate params', function () {
      var doc = {a: 1, b: {c: 2}};
      coll.insert(doc);
      var params = makeRequest.calls[0].args[1];
      expect(params.document).toEqual(doc);
    });

    it('uses the post HTTP method', function () {
      coll.insert({});
      expect(makeRequest.calls[0].args[2]).toEqual('POST');
    });

    it('uses the collection\'s shell', function () {
      coll.insert({});
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });
  });

  describe('remove', function () {
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.remove({}, true);
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/remove');
    });

    it('constructs appropriate params', function () {
      var constraint = {a: 1, b: {$gt: 2}};
      coll.remove(constraint, false);
      var params = makeRequest.calls[0].args[1];
      expect(params.constraint).toEqual(constraint);
      expect(params.just_one).toBe(false);
    });

    it('uses the delete HTTP method', function () {
      coll.remove({}, true);
      expect(makeRequest.calls[0].args[2]).toEqual('DELETE');
    });

    it('uses the collection\'s shell', function () {
      coll.remove({}, true);
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });
  });

  describe('update', function () {
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.update({}, {});
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/update');
    });

    it('constructs appropriate params', function () {
      var constraint = {a: 1, b: {$gt: 2}};
      var update = {$set: {c: 2}};
      coll.update(constraint, update);
      var params = makeRequest.calls[0].args[1];
      expect(params.query).toEqual(constraint);
      expect(params.update).toEqual(update);
    });

    describe('upsert and multi', function () {
      var constraint_ = {a: 1};
      var update_ = {$set: {a: 2}};

      it('defaults to false', function () {
        coll.update(constraint_, update_);
        var params = makeRequest.calls[0].args[1];
        expect(params.upsert).toBe(false);
        expect(params.multi).toBe(false);
      });

      it('takes boolean parameters', function () {
        coll.update(constraint_, update_, true, true);
        var params = makeRequest.calls[0].args[1];
        expect(params.upsert).toBe(true);
        expect(params.multi).toBe(true);
      });

      it('takes one object parameter', function () {
        var options = {upsert: false, multi: true};
        coll.update(constraint_, update_, options);
        var params = makeRequest.calls[0].args[1];
        expect(params.upsert).toBe(false);
        expect(params.multi).toBe(true);

        expect(function () {
          coll.update(constraint_, update_, options, false);
        }).toThrow({message: 'dbCollectionUpdate: Syntax error'});
      });
    });

    it('uses the put HTTP method', function () {
      coll.update({}, {});
      expect(makeRequest.calls[0].args[2]).toEqual('PUT');
    });

    it('uses the collection\'s shell', function () {
      coll.update({}, {});
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });
  });

  describe('aggregate', function(){
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.aggregate([{$match: {}}]);
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/aggregate');
    });

    it('takes empty params', function(){
      coll.aggregate();
      expect(makeRequest.calls[0].args[1]).toEqual([]);
    });

    it('constructs appropriate params', function () {
      var query = [{$match: {}}];
      coll.aggregate(query);
      expect(makeRequest.calls[0].args[1]).toEqual(query);
    });

    it('uses the GET HTTP method', function () {
      coll.aggregate({});
      expect(makeRequest.calls[0].args[2]).toEqual('GET');
    });

    it('uses the collection\'s shell', function () {
      coll.aggregate({});
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });

    it('returns the aggregation results', function () {
      var results = {
        status: 'ok',
        results: ['a', 'b', 'c']
      };
      makeRequest.andCallFake(function () {
        arguments[5](results);
      });
      var actual = coll.aggregate({});
      expect(actual).toEqual(results);
    });
  });

  describe('drop', function () {
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.drop();
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/drop');
    });

    it('uses the delete HTTP method', function () {
      coll.drop();
      expect(makeRequest.calls[0].args[2]).toEqual('DELETE');
    });

    it('uses the collection\'s shell', function () {
      coll.drop();
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });
  });

  describe('ensureIndex', function(){
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.ensureIndex({a: 1});
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/ensureIndex');
    });

    it('constructs appropriate params', function () {
      var keys = {a: 1, b: '2d'};
      var options = {
        background: true,
        unique: true,
        name: 'index',
        dropDups: true,
        sparse: true,
        expireAfterSeconds: 60
      };
      coll.ensureIndex(keys, options);
      var params = makeRequest.calls[0].args[1];
      expect(params.keys).toEqual(keys);
      expect(params.options).toEqual(options);
    });

    it('uses the POST HTTP method', function () {
      coll.ensureIndex({a: 1});
      expect(makeRequest.calls[0].args[2]).toEqual('POST');
    });

    it('uses the collection\'s shell', function () {
      coll.ensureIndex({a: 1});
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });
  });

  describe('reIndex', function(){
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.reIndex();
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/reIndex');
    });

    it('uses the PUT HTTP method', function () {
      coll.reIndex();
      expect(makeRequest.calls[0].args[2]).toEqual('PUT');
    });

    it('uses the collection\'s shell', function () {
      coll.reIndex();
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });
  });

  describe('dropIndex', function(){
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.dropIndex('name');
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/dropIndex');
    });

    it('constructs appropriate params', function () {
      coll.dropIndex('name');
      var params = makeRequest.calls[0].args[1];
      expect(params.name).toEqual('name');
    });

    it('uses the DELETE HTTP method', function () {
      coll.dropIndex('name');
      expect(makeRequest.calls[0].args[2]).toEqual('DELETE');
    });

    it('uses the collection\'s shell', function () {
      coll.dropIndex('name');
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });
  });

  describe('dropIndexes', function(){
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.dropIndexes();
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/dropIndexes');
    });

    it('uses the DELETE HTTP method', function () {
      coll.dropIndexes();
      expect(makeRequest.calls[0].args[2]).toEqual('DELETE');
    });

    it('uses the collection\'s shell', function () {
      coll.dropIndexes();
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });
  });

  describe('getIndexes', function(){
    it('uses the collection url', function () {
      coll.urlBase = 'test_url_base/';
      coll.getIndexes();
      expect(makeRequest.calls[0].args[0]).toEqual('test_url_base/getIndexes');
    });

    it('uses the GET HTTP method', function () {
      coll.getIndexes();
      expect(makeRequest.calls[0].args[2]).toEqual('GET');
    });

    it('uses the collection\'s shell', function () {
      coll.getIndexes();
      expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
    });

    it('returns the indexes array', function () {
      makeRequest.andCallFake(function(a, b, c, d, e, fn){ fn(['data']); });
      expect(coll.getIndexes()).toEqual(['data']);
    });
  });
});
