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

/* jshint camelcase: false */
/* global afterEach, beforeEach, describe, expect, it, jasmine, mongo, sinon, spyOn, noty:true */
describe('The request module', function () {
  var RES_URL = 'resURL/';
  var configStore;
  var xhr, requests;

  beforeEach(function () {
    spyOn(mongo.util, 'getDBCollectionResURL').andReturn(RES_URL);
    spyOn(mongo.util, 'getDBResURL').andReturn(RES_URL);
    configStore = mongo.config;
    mongo.config = {};

    xhr = sinon.useFakeXMLHttpRequest();
    xhr.onCreate = function (xhr) { requests.push(xhr); };
    requests = [];
  });

  afterEach(function () {
    mongo.config = configStore;
    configStore = null;

    xhr.restore();
  });

  describe('making a request', function () {
    var url_, data_, method_, name_, shell_;

    beforeEach(function () {
      url_ = 'http://test.com/';
      data_ = {test: 'my data'};
      method_ = 'POST';
      name_ = 'test';
      shell_ = {insertResponseLine: function () {}};
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

  describe('keeps the session alive and', function(){
    var requestSuccess = function(success){
      var shell = {mwsResourceID: 'my_resource'};
      mongo.request.keepAlive(shell);
      requests[0].respond(success ? 204 : 500, {}, null);
    };

    beforeEach(function(){
      noty = jasmine.createSpy();
    });

    it('makes a keepalive request', function () {
      mongo.config.baseUrl = 'base';
      var resourceID = 'iu';
      var expectedURL = mongo.config.baseUrl + resourceID + '/keep-alive';
      mongo.request.keepAlive(resourceID);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('POST');
      expect(req.url).toBe(expectedURL);
      expect(req.requestBody).toBe(null);
      // There is nothing to test for if the request succeeds or not.
    });

    it('notifies the user on disconnection', function(){
      requestSuccess(false);
      expect(noty).toHaveBeenCalled();
    });

    it('does not create notification on success', function(){
      requestSuccess(true);
      expect(noty).not.toHaveBeenCalled();
    });

    it('closes notification once on success', function(){
      spyOn(window, 'setTimeout').andCallThrough();
      jasmine.Clock.useMock();
      mongo.keepaliveNotification = jasmine.createSpyObj('keepaliveNotification',
                                                        ['close', 'setText']);
      mongo.keepaliveNotification.close.andCallFake(function(){
        delete mongo.keepaliveNotification;
      });

      requestSuccess(true);
      expect(mongo.keepaliveNotification.setText).toHaveBeenCalledWith('and we\'re back!');
      expect(window.setTimeout).toHaveBeenCalled();

      expect(mongo.keepaliveNotification.close).not.toHaveBeenCalled();
      jasmine.Clock.tick(1501);
      expect(mongo.keepaliveNotification).toBe(undefined);

      window.setTimeout.reset();

      requestSuccess(true);
      expect(window.setTimeout).not.toHaveBeenCalled();
      expect(mongo.keepaliveNotification).toBe(undefined);
    });
  });
  
  /**
   * Valids the requests themselves, rather than the actions taken upon their
   * failure or success.
   */
  describe('creates a request that', function () {
    it('creates an MWS resource', function () {
      var baseUrl = '/mws/';
      mongo.config.baseUrl = baseUrl;
      var callbackSpy = jasmine.createSpy('callback');
      var shellSpy = jasmine.createSpyObj('Shell', ['insertResponseLine', 'insertError']);

      mongo.request.createMWSResource([shellSpy], callbackSpy);
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
      mongo.request.createMWSResource([shellSpy], callbackSpy);
      req = requests[1];
      req.respond(200, '', JSON.stringify({daebak: 'iu'}));
      expect(shellSpy.insertError).toHaveBeenCalled();

      // Failure: HTTP error.
      mongo.request.createMWSResource([shellSpy], callbackSpy);
      req = requests[2];
      req.respond(404, '', '');
      expect(shellSpy.insertResponseLine).toHaveBeenCalled();

      expect(callbackSpy.calls.length).toBe(1);
    });

    it('keeps the shell mws resource alive', function () {
      mongo.config.baseUrl = 'base';
      var resourceID = 'iu';
      var expectedURL = mongo.config.baseUrl + resourceID +
          '/keep-alive';
      mongo.request.keepAlive(resourceID);
      expect(requests.length).toBe(1);
      var req = requests[0];
      expect(req.method).toBe('POST');
      expect(req.url).toBe(expectedURL);
      expect(req.requestBody).toBe(null);
      // There is nothing to test for if the request succeeds or not.
    });
  });
});
