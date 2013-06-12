/* jshint camelcase: false */
/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, sinon */
/* global spyOn */
describe('The request module', function () {
  var RES_URL = 'resURL/';
  var configStore;

  beforeEach(function () {
    spyOn(mongo.util, 'getDBCollectionResURL').andReturn(RES_URL);
    spyOn(mongo.util, 'pruneKeys');
    spyOn(mongo.util, 'stringifyKeys');
    configStore = mongo.config;
    mongo.config = {};
  });

  afterEach(function () {
    mongo.config = configStore;
    configStore = null;
  });

  describe('making a request', function () {
    var requests, xhr;
    var url_, data_, method_, name_, shell_;

    beforeEach(function () {
      xhr = sinon.useFakeXMLHttpRequest();
      xhr.onCreate = function (xhr) { requests.push(xhr); };
      requests = [];

      url_ = 'http://test.com/';
      data_ = {test: 'my data'};
      method_ = 'POST';
      name_ = 'test';
      shell_ = {insertResponseLine: function () {}};
    });

    afterEach(function () {
      requests = null;
      xhr.restore();
    });

    it('uses the given url and HTTP method', function () {
      var url = 'http://test.com/';
      var method = 'POST';
      mongo.request.__makeRequest(url, data_, method, name_);

      expect(requests[0].url).toEqual(url);
      expect(requests[0].method).toEqual(method);
    });

    it('stringifies JSON', function () {
      var data = {foo: 'mydata'};
      mongo.request.__makeRequest(url_, data, method_, name_);

      var stringifiedData = JSON.stringify(data);
      expect(requests[0].requestBody).toEqual(stringifiedData);
      expect(requests[0].requestHeaders['Content-Type']).toMatch('application/json');
      expect(requests[0].requestHeaders.Accept).toMatch('^application/json, text/javascript');
    });

    it('calls onSuccess appropriately', function () {
      var onSuccess = jasmine.createSpy();

      mongo.request.__makeRequest(url_, data_, method_, name_, shell_, onSuccess);
      requests[0].respond(500, '', 'INTERNAL SERVER ERROR');
      expect(onSuccess).not.toHaveBeenCalled();

      mongo.request.__makeRequest(url_, data_, method_, name_, shell_, onSuccess);
      expect(onSuccess).not.toHaveBeenCalled();
      var originalData = {msg: 'Success'};
      var responseBody = JSON.stringify(originalData);
      requests[1].respond(200, '', responseBody);
      expect(onSuccess).toHaveBeenCalledWith(originalData);
    });

    it('writes failure reasons to the shell', function () {
      var shell = {insertResponseLine: jasmine.createSpy()};
      mongo.request.__makeRequest(url_, data_, method_, name_, shell);
      requests[0].respond(200, '', JSON.stringify({foo: 'bar'}));
      expect(shell.insertResponseLine).not.toHaveBeenCalled();

      // Error, no details
      mongo.request.__makeRequest(url_, data_, method_, name_, shell);
      var errResponse = JSON.stringify({error: 400, reason: 'My Reason', detail: ''});
      requests[1].respond(400, '', errResponse);
      expect(shell.insertResponseLine).toHaveBeenCalledWith('ERROR: My Reason');

      // Error with details
      mongo.request.__makeRequest(url_, data_, method_, name_, shell);
      errResponse = JSON.stringify({error: 400, reason: 'My Reason', detail: 'Some details'});
      requests[2].respond(400, '', errResponse);
      expect(shell.insertResponseLine).toHaveBeenCalledWith('ERROR: My Reason\nSome details');

      expect(shell.insertResponseLine.calls.length).toEqual(2);
    });

    it('is asynchronous by default', function () {
      mongo.request.__makeRequest(url_, data_, method_, name_, shell_, null);
      expect(requests[0].async).toBe(true);

      mongo.request.__makeRequest(url_, data_, method_, name_, shell_, null, true);
      expect(requests[1].async).toBe(true);

      mongo.request.__makeRequest(url_, data_, method_, name_, shell_, null, false);
      expect(requests[2].async).toBe(false);
    });
  });

  describe('remove', function () {
    var makeRequest;
    var query_;
    beforeEach(function () {
      spyOn(mongo.request, '__makeRequest');
      makeRequest = mongo.request.__makeRequest;

      query_ = {
        shell: {mwsResourceID: 'my_resource'},
        collection: 'my_collection'
      };
    });

    it('constructs and uses the collection url', function () {
      var getUrl = mongo.util.getDBCollectionResURL;
      getUrl.andReturn('my_test_url/');
      var query = {
        shell: {mwsResourceID: 'my_resource'},
        collection: 'my_collection'
      };

      mongo.request.dbCollectionRemove(query, {}, true);
      expect(getUrl).toHaveBeenCalledWith('my_resource', 'my_collection');
      expect(makeRequest.calls[0].args[0]).toEqual('my_test_url/remove');
    });

    it('constructs appropriate params', function () {
      var constraint = {a: 1, b: {$gt: 2}};
      mongo.request.dbCollectionRemove(query_, constraint, false);
      var params = makeRequest.calls[0].args[1];
      expect(params.constraint).toEqual(constraint);
      expect(params.just_one).toBe(false);
    });

    it('uses the delete HTTP method', function () {
      mongo.request.dbCollectionRemove(query_, {}, true);
      expect(makeRequest.calls[0].args[2]).toEqual('DELETE');
    });

    it('uses the supplied shell', function () {
      var shell = {mwsResourceID: 'my_resource'};
      var query = {
        shell: shell,
        collection: 'my_collection'
      };
      mongo.request.dbCollectionRemove(query, {}, true);
      expect(makeRequest.calls[0].args[4]).toBe(shell);
    });
  });

  describe('update', function () {
    var makeRequest;
    var query_;
    beforeEach(function () {
      spyOn(mongo.request, '__makeRequest');
      makeRequest = mongo.request.__makeRequest;

      query_ = {
        shell: {
          mwsResourceID: 'my_resource',
          insertResponseLine: function () {}
        },
        collection: 'my_collection'
      };
    });

    it('constructs and uses the collection url', function () {
      var getUrl = mongo.util.getDBCollectionResURL;
      getUrl.andReturn('my_test_url/');
      var query = {
        shell: {mwsResourceID: 'my_resource'},
        collection: 'my_collection'
      };

      mongo.request.dbCollectionUpdate(query, {}, true);
      expect(getUrl).toHaveBeenCalledWith('my_resource', 'my_collection');
      expect(makeRequest.calls[0].args[0]).toEqual('my_test_url/update');
    });

    it('constructs appropriate params', function () {
      var constraint = {a: 1, b: {$gt: 2}};
      var update = {$set: {c: 2}};
      mongo.request.dbCollectionUpdate(query_, constraint, update);
      var params = makeRequest.calls[0].args[1];
      expect(params.query).toEqual(constraint);
      expect(params.update).toEqual(update);
    });

    describe('upsert and multi', function () {
      var constraint_ = {a: 1};
      var update_ = {$set: {a: 2}};

      it('defaults to false', function () {
        mongo.request.dbCollectionUpdate(query_, constraint_, update_);
        var params = makeRequest.calls[0].args[1];
        expect(params.upsert).toBe(false);
        expect(params.multi).toBe(false);
      });

      it('takes boolean parameters', function () {
        mongo.request.dbCollectionUpdate(query_, constraint_, update_, true, true);
        var params = makeRequest.calls[0].args[1];
        expect(params.upsert).toBe(true);
        expect(params.multi).toBe(true);
      });

      it('takes one object parameter', function () {
        var options = {upsert: false, multi: true};
        mongo.request.dbCollectionUpdate(query_, constraint_, update_, options);
        var params = makeRequest.calls[0].args[1];
        expect(params.upsert).toBe(false);
        expect(params.multi).toBe(true);

        expect(function () {
          mongo.request.dbCollectionUpdate(query_, constraint_, update_, options, false);
        }).toThrow({message: 'dbCollectionUpdate: Syntax error'});
      });
    });

    it('uses the put HTTP method', function () {
      mongo.request.dbCollectionUpdate(query_, {}, true);
      expect(makeRequest.calls[0].args[2]).toEqual('PUT');
    });

    it('uses the supplied shell', function () {
      var shell = {mwsResourceID: 'my_resource'};
      var query = {
        shell: shell,
        collection: 'my_collection'
      };
      mongo.request.dbCollectionUpdate(query, {}, true);
      expect(makeRequest.calls[0].args[4]).toBe(shell);
    });
  });

  describe('drop', function () {
    var makeRequest;
    var query_;
    beforeEach(function () {
      spyOn(mongo.request, '__makeRequest');
      makeRequest = mongo.request.__makeRequest;

      query_ = {
        shell: {mwsResourceID: 'my_resource'},
        collection: 'my_collection'
      };
    });

    it('constructs and uses the collection url', function () {
      var getUrl = mongo.util.getDBCollectionResURL;
      getUrl.andReturn('my_test_url/');
      var query = {
        shell: {mwsResourceID: 'my_resource'},
        collection: 'my_collection'
      };

      mongo.request.dbCollectionDrop(query);
      expect(getUrl).toHaveBeenCalledWith('my_resource', 'my_collection');
      expect(makeRequest.calls[0].args[0]).toEqual('my_test_url/drop');
    });

    it('uses the delete HTTP method', function () {
      mongo.request.dbCollectionDrop(query_);
      expect(makeRequest.calls[0].args[2]).toEqual('DELETE');
    });

    it('uses the supplied shell', function () {
      var shell = {mwsResourceID: 'my_resource'};
      var query = {
        shell: shell,
        collection: 'my_collection'
      };
      mongo.request.dbCollectionDrop(query);
      expect(makeRequest.calls[0].args[4]).toBe(shell);
    });
  });

  /**
   * Valids the requests themselves, rather than the actions taken upon their
   * failure or success.
   */
  describe('creates a request that', function () {
    var requests, xhr;

    beforeEach(function () {
      xhr = sinon.useFakeXMLHttpRequest();
      xhr.onCreate = function (xhr) { requests.push(xhr); };
      requests = [];
    });

    afterEach(function () {
      requests = null;
      xhr.restore();
    });

    it('creates an MWS resource', function () {
      var baseUrl = '/mws/';
      mongo.config.baseUrl = baseUrl;
      var callbackSpy = jasmine.createSpy('callback');
      var shellSpy = jasmine.createSpyObj('Shell', ['insertResponseLine']);

      mongo.request.createMWSResource(shellSpy, callbackSpy);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('POST');
      expect(req.url).toBe(baseUrl);
      expect(req.requestBody).toBe(null);

      var body = {res_id: 'iu'};
      // TODO: FF23 complains 'not well-formed' for response body, but
      // continues testing anyway. Chromium is fine.
      req.respond(200, '', JSON.stringify(body));
      expect(callbackSpy).toHaveBeenCalledWith(body);
      expect(shellSpy.insertResponseLine).not.toHaveBeenCalled();

      // Failure: invalid data.
      mongo.request.createMWSResource(shellSpy, callbackSpy);
      req = requests[1];
      req.respond(200, '', JSON.stringify({daebak: 'iu'}));
      expect(shellSpy.insertResponseLine).toHaveBeenCalled();

      // Failure: HTTP error.
      mongo.request.createMWSResource(shellSpy, callbackSpy);
      req = requests[2];
      req.respond(404, '', '');
      expect(shellSpy.insertResponseLine.calls.length).toBe(2);

      expect(callbackSpy.calls.length).toBe(1);
    });

    it('calls db.collection.find() on the database', function () {
      var cursor = {
        _query: {args: {projection: {_id: 0}, query: {iu: 'jjang'}}},
        _shell: jasmine.createSpyObj('Shell', ['insertResponseLine']),
        _storeQueryResult: jasmine.createSpy('storeQueryResult')
      };
      var callbackSpy = jasmine.createSpy('callback');
      var async = true;

      mongo.request.dbCollectionFind(cursor, callbackSpy, async);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('GET');
      var actualURL = decodeURIComponent(req.url);
      expect(actualURL).toMatch('^' + RES_URL + 'find?');
      var expectedJson = '"projection":' + JSON.stringify({_id: cursor._query.args.projection._id});
      expect(actualURL).toMatch('find?.*' + expectedJson);
      expectedJson = '"query":' + JSON.stringify({iu: cursor._query.args.query.iu});
      expect(actualURL).toMatch('find?.*' + expectedJson);
      expect(req.requestBody).toBe(null);
      expect(req.async).toBe(async);
      expect(req.requestHeaders.Accept).toMatch('application/json');
      expect(callbackSpy).not.toHaveBeenCalled();

      async = false;
      mongo.request.dbCollectionFind(cursor, callbackSpy, async);
      req = requests[1];
      expect(req.async).toBe(async);
      expect(callbackSpy).not.toHaveBeenCalled();

      req = requests[0];
      var expectedResult = [{iu: 'jjang'}, {exo: 'k'}];
      // TODO: This status code is undocumented.
      var body = {status: 0, result: expectedResult};
      req.respond(200, '', JSON.stringify(body));
      expect(cursor._storeQueryResult).toHaveBeenCalledWith(expectedResult);
      expect(callbackSpy).toHaveBeenCalled();
      expect(cursor._shell.insertResponseLine).not.toHaveBeenCalled();

      // Failure: HTTP Error.
      // XXX: req.respond only seems to work if async === true.
      mongo.request.dbCollectionFind(cursor, callbackSpy, true);
      req = requests[2];
      req.respond(404, '', JSON.stringify(body));
      expect(cursor._storeQueryResult.call.length).toBe(1);
      expect(callbackSpy.calls.length).toBe(1);
      expect(cursor._shell.insertResponseLine).toHaveBeenCalled();
      // TODO: How to catch the exception?

      // Failure: Bad status code.
      body = {error: 500, reason: 'Internal Server Error', detail: ''};
      mongo.request.dbCollectionFind(cursor, callbackSpy, true);
      req = requests[3];
      req.respond(500, '', JSON.stringify(body));
      expect(cursor._storeQueryResult.call.length).toBe(1);
      expect(callbackSpy.calls.length).toBe(1);
      expect(cursor._shell.insertResponseLine.calls.length).toBe(2);
    });

    it('calls db.collection.insert() on the database', function () {
      var query = {
        shell: jasmine.createSpyObj('Shell', ['insertResponseLine'])
      };
      var document_ = 'doc';
      mongo.request.dbCollectionInsert(query, document_);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('POST');
      expect(req.url).toBe(RES_URL + 'insert');
      var expectedParams = JSON.stringify({document: document_});
      expect(req.requestBody).toMatch(expectedParams);
      expect(req.requestHeaders.Accept).toMatch('application/json');
      expect(req.requestHeaders['Content-Type']).toMatch('application/json');

      req.respond(200, '', '{}');
      expect(query.shell.insertResponseLine).not.toHaveBeenCalled();

      // Failure: HTTP error.
      mongo.request.dbCollectionInsert(query, document_);
      req = requests[1];
      req.respond(404, '', '{}');
      expect(query.shell.insertResponseLine).toHaveBeenCalled();
    });

    it('keeps the shell mws resource alive', function () {
      mongo.config.baseUrl = 'base';
      var shell = {mwsResourceID: 'iu'};
      var expectedURL = mongo.config.baseUrl + shell.mwsResourceID +
          '/keep-alive';
      mongo.request.keepAlive(shell);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('POST');
      expect(req.url).toBe(expectedURL);
      expect(req.requestBody).toBe(null);
      // There is nothing to test for if the request succeeds or not.
    });
  });
});
