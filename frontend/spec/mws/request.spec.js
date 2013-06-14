/* jshint camelcase: false */
/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, sinon */
/* global spyOn */
describe('The request module', function () {
  var RES_URL = 'resURL/';
  var configStore;

  beforeEach(function () {
    spyOn(mongo.util, 'getDBCollectionResURL').andReturn(RES_URL);
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
      mongo.request.makeRequest(url, data_, method, name_);

      expect(requests[0].url).toEqual(url);
      expect(requests[0].method).toEqual(method);
    });

    it('stringifies JSON', function () {
      var data = {foo: 'mydata'};
      mongo.request.makeRequest(url_, data, method_, name_);

      var stringifiedData = JSON.stringify(data);
      expect(requests[0].requestBody).toEqual(stringifiedData);
      expect(requests[0].requestHeaders['Content-Type']).toMatch('application/json');
      expect(requests[0].requestHeaders.Accept).toMatch('^application/json, text/javascript');
    });

    it('calls onSuccess appropriately', function () {
      var onSuccess = jasmine.createSpy();

      mongo.request.makeRequest(url_, data_, method_, name_, shell_, onSuccess);
      requests[0].respond(500, '', 'INTERNAL SERVER ERROR');
      expect(onSuccess).not.toHaveBeenCalled();

      mongo.request.makeRequest(url_, data_, method_, name_, shell_, onSuccess);
      expect(onSuccess).not.toHaveBeenCalled();
      var originalData = {msg: 'Success'};
      var responseBody = JSON.stringify(originalData);
      requests[1].respond(200, '', responseBody);
      expect(onSuccess).toHaveBeenCalledWith(originalData);
    });

    it('writes failure reasons to the shell', function () {
      var shell = {insertResponseLine: jasmine.createSpy()};
      mongo.request.makeRequest(url_, data_, method_, name_, shell);
      requests[0].respond(200, '', JSON.stringify({foo: 'bar'}));
      expect(shell.insertResponseLine).not.toHaveBeenCalled();

      // Error, no details
      mongo.request.makeRequest(url_, data_, method_, name_, shell);
      var errResponse = JSON.stringify({error: 400, reason: 'My Reason', detail: ''});
      requests[1].respond(400, '', errResponse);
      expect(shell.insertResponseLine).toHaveBeenCalledWith('ERROR: My Reason');

      // Error with details
      mongo.request.makeRequest(url_, data_, method_, name_, shell);
      errResponse = JSON.stringify({error: 400, reason: 'My Reason', detail: 'Some details'});
      requests[2].respond(400, '', errResponse);
      expect(shell.insertResponseLine).toHaveBeenCalledWith('ERROR: My Reason\nSome details');

      expect(shell.insertResponseLine.calls.length).toEqual(2);
    });

    it('is asynchronous by default', function () {
      mongo.request.makeRequest(url_, data_, method_, name_, shell_, null);
      expect(requests[0].async).toBe(true);

      mongo.request.makeRequest(url_, data_, method_, name_, shell_, null, true);
      expect(requests[1].async).toBe(true);

      mongo.request.makeRequest(url_, data_, method_, name_, shell_, null, false);
      expect(requests[2].async).toBe(false);
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
