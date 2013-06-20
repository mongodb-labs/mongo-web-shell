/* global describe, it, beforeEach, mongo, spyOn, expect */
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
    it('returns a cursor with the proper shell', function () {
      var cursor = coll.find({}, {});
      expect(cursor._shell).toEqual(coll.shell);
    });

    describe('cursor query function', function () {
      var queryFunc, query_, projection_;
      var onSuccess_, async_;
      beforeEach(function () {
        spyOn(mongo, 'Cursor');

        query_ = {a: 1, b: {$gt: 2}};
        projection_ = {_id: 0, c: 1};
        coll.find(query_, projection_);
        queryFunc = mongo.Cursor.calls[0].args[1];

        onSuccess_ = function () {};
        async_ = true;
      });

      it('uses the collection url', function () {
        queryFunc(onSuccess_, async_);
        expect(makeRequest.calls[0].args[0]).toEqual(coll.urlBase + 'find');
      });

      it('constructs appropriate params', function () {
        queryFunc(onSuccess_, async_);
        var params = makeRequest.calls[0].args[1];
        expect(params.query).toEqual(query_);
        expect(params.projection).toEqual(projection_);
      });

      it('uses the get HTTP method', function () {
        queryFunc(onSuccess_, async_);
        expect(makeRequest.calls[0].args[2]).toEqual('GET');
      });

      it('uses the collection\'s shell', function () {
        queryFunc(onSuccess_, async_);
        expect(makeRequest.calls[0].args[4]).toBe(coll.shell);
      });

      it('uses the supplied on success function', function () {
        var onSuccess = function () { return 'test on success function'; };
        queryFunc(onSuccess, async_);
        expect(makeRequest.calls[0].args[5]).toBe(onSuccess);
      });

      it('uses the supplied on async flag', function () {
        var async = true;
        queryFunc(onSuccess_, async);
        expect(makeRequest.calls[0].args[6]).toBe(async);

        async = false;
        queryFunc(onSuccess_, async);
        expect(makeRequest.calls[1].args[6]).toBe(async);
      });
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
});