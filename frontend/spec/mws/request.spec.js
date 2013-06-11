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
      body = {status: -1, result: expectedResult};
      mongo.request.dbCollectionFind(cursor, callbackSpy, true);
      req = requests[3];
      req.respond(200, '', JSON.stringify(body));
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
