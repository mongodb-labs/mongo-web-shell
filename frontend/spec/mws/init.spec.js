/* jshint camelcase: false */
/* global afterEach, beforeEach, CONST, describe, expect, it, jasmine, mongo, sinon */
/* global spyOn */
describe('The init function', function () {
  var creationSuccess, dataObj;
  var mwsHost = 'host';
  var expected = {
    config: {
      cssPath: 'css',
      mwsHost: mwsHost,
      baseUrl: mwsHost + CONST.domConfig.baseUrlPostfix
    }
  };

  beforeEach(function () {
    jasmine.Clock.useMock();
    spyOn(mongo.dom, 'injectStylesheet');
    spyOn(mongo.dom, 'retrieveConfig').andReturn(expected.config);
    spyOn(mongo.request, 'createMWSResource').andCallFake(function (
        shell, onSuccess) {
      if (creationSuccess) {
        onSuccess(dataObj);
      }
    });
    spyOn(mongo.util, 'enableConsoleProtection');
    creationSuccess = false; // Avoids running additional code on each request.
    dataObj = {
      res_id: 'iu',
      is_new: true
    };
  });

  afterEach(function () {
    mongo.config = null;
    mongo.shells = [];
  });

  it('enables console protection', function () {
    mongo.init.run();
    expect(mongo.dom.retrieveConfig).toHaveBeenCalled();
  });

  it('retrieves and sets the script configuration', function () {
    mongo.init.run();
    expect(mongo.dom.retrieveConfig).toHaveBeenCalled();
    expect(mongo.config).toEqual(expected.config);
  });

  it('injects the web shell stylesheet', function () {
    mongo.init.run();
    expect(mongo.dom.injectStylesheet).toHaveBeenCalledWith(
        expected.config.cssPath);
  });

  describe('for each web shell div in the DOM', function () {
    var SHELL_COUNT = 3;
    var shellElements;

    beforeEach(function () {
      shellElements = [];
      for (var i = 0; i < SHELL_COUNT; i++) {
        var element = $('<div class=' + CONST.css.classes.root + '/>');
        $('body').append(element);
        shellElements.push(element.get(0));
      }
    });

    afterEach(function () {
      $('.' + CONST.css.classes.root).remove();
    });

    it('constructs a new shell', function () {
      spyOn(mongo, 'Shell');

      mongo.init.run();
      expect(mongo.Shell.calls.length).toBe(SHELL_COUNT);
      shellElements.forEach(function (element, i) {
        expect(mongo.Shell).toHaveBeenCalledWith(element, i);
      });
    });

    it('attaches and enables input handlers on mws resource creation', function () {
      var attachInputHandler = spyOn(mongo.Shell.prototype, 'attachInputHandler');
      var keepAlive = spyOn(mongo.request, 'keepAlive');

      // Unsuccessful creation.
      mongo.init.run();
      expect(attachInputHandler).not.toHaveBeenCalled();
      jasmine.Clock.tick(mongo.const.keepAliveTime);
      expect(keepAlive).not.toHaveBeenCalled();

      creationSuccess = true;
      mongo.init.run();
      expect(attachInputHandler.calls.length).toBe(SHELL_COUNT);
      expect(attachInputHandler).toHaveBeenCalledWith(dataObj.res_id);
      jasmine.Clock.tick(mongo.const.keepAliveTime - 1);
      expect(keepAlive).not.toHaveBeenCalled();
      jasmine.Clock.tick(1);
      expect(keepAlive).toHaveBeenCalled();
    });

    describe('with a data-initialize-url attribute', function () {
      var xhr, requests;
      beforeEach(function () {
        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = function (xhr) { requests.push(xhr); };
        requests = [];

        creationSuccess = true;
      });

      afterEach(function () {
        xhr.restore();
      });

      it('sends a request to the specified location', function () {
        shellElements[0].setAttribute('data-initialization-url', '/my/url/path');
        var attachInput = spyOn(mongo.Shell.prototype, 'attachInputHandler');
        mongo.init.run();

        // The call to createMSWResource is mocked and did not make a request
        expect(requests.length).toEqual(1);
        expect(requests[0].url).toEqual('/my/url/path');
        expect(requests[0].requestBody).toEqual('{"res_id":"' + dataObj.res_id + '"}');

        // The initialization should not proceed until the request has returned
        expect(attachInput).not.toHaveBeenCalled();
        requests[0].respond(200, '', 'ok');
        expect(attachInput).toHaveBeenCalled();
      });

      it('can handle multiple initialization urls', function () {
        shellElements[0].setAttribute('data-initialization-url', '/my/first/url');
        shellElements[1].setAttribute('data-initialization-url', '/my/second/url');
        shellElements[2].setAttribute('data-initialization-url', '/my/third/url');
        var attachInput = spyOn(mongo.Shell.prototype, 'attachInputHandler');
        mongo.init.run();

        // The call to createMSWResource is mocked and did not make a request
        expect(requests.length).toEqual(3);
        expect(requests[0].url).toEqual('/my/first/url');
        expect(requests[1].url).toEqual('/my/second/url');
        expect(requests[2].url).toEqual('/my/third/url');
        expect(requests[0].requestBody).toEqual('{"res_id":"' + dataObj.res_id + '"}');
        expect(requests[1].requestBody).toEqual('{"res_id":"' + dataObj.res_id + '"}');
        expect(requests[2].requestBody).toEqual('{"res_id":"' + dataObj.res_id + '"}');

        // The initialization should not proceed until all the requests have returned
        expect(attachInput).not.toHaveBeenCalled();
        requests[0].respond(200, '', 'ok');
        expect(attachInput).not.toHaveBeenCalled();
        requests[2].respond(200, '', 'ok');
        expect(attachInput).not.toHaveBeenCalled();
        requests[1].respond(200, '', 'ok');
        expect(attachInput).toHaveBeenCalled();
      });

      it('does not send duplicate requsets', function () {
        shellElements[0].setAttribute('data-initialization-url', '/my/url/path');
        shellElements[1].setAttribute('data-initialization-url', '/my/url/path');
        mongo.init.run();

        // The call to createMSWResource is mocked and did not make a request
        expect(requests.length).toEqual(1);
        expect(requests[0].url).toEqual('/my/url/path');
      });

      it('only initializes if the resource id is new', function () {
        dataObj.is_new = false;
        shellElements[0].setAttribute('data-initialization-url', '/my/url/path');
        mongo.init.run();

        expect(requests.length).toEqual(0);
      });
    });

    describe('with a data-initialize-json attribute', function () {
      var xhr, requests;
      beforeEach(function () {
        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = function (xhr) { requests.push(xhr); };
        requests = [];

        creationSuccess = true;
      });

      afterEach(function () {
        xhr.restore();
      });

      it('condenses and inserts the json data into the database', function () {
        var firstJson = JSON.stringify({foo: [{msg: 'hi'}]});
        var secondJson = JSON.stringify({bar: [{baz: 'garply'}]});
        var expected = JSON.stringify({
          res_id: dataObj.res_id,
          collections: {
            foo: [{msg: 'hi'}],
            bar: [{baz: 'garply'}, {baz: 'garply'}]
          }
        });
        shellElements[0].setAttribute('data-initialization-json', firstJson);
        shellElements[1].setAttribute('data-initialization-json', secondJson);
        // Duplicate json should be allowed
        shellElements[2].setAttribute('data-initialization-json', secondJson);
        var attachInput = spyOn(mongo.Shell.prototype, 'attachInputHandler');
        mongo.init.run();

        // The call to createMSWResource is mocked and did not make a request
        expect(requests.length).toEqual(1);
        expect(requests[0].url).toEqual('/init/load_json');
        expect(requests[0].requestBody).toEqual(expected);

        // The initialization should not proceed until the request has returned
        expect(attachInput).not.toHaveBeenCalled();
        requests[0].respond(204, '', '');
        expect(attachInput).toHaveBeenCalled();
      });

      it('fetches remote json', function () {
        var localData = JSON.stringify({
          coll: [{data: 'local'}]
        });
        var remoteData = JSON.stringify({
          coll: [{data: 'remote'}]
        });
        var totalData = JSON.stringify({
          res_id: dataObj.res_id,
          collections: {
            coll: [{data: 'local'}, {data: 'remote'}]
          }
        });
        shellElements[0].setAttribute('data-initialization-json', '/my/json/url');
        shellElements[1].setAttribute('data-initialization-json', localData);
        mongo.init.run();

        // Fetches remote json
        expect(requests.length).toEqual(1);
        expect(requests[0].url).toEqual('/my/json/url');
        requests[0].respond(200, {'Content-Type': 'application/json'}, remoteData);

        // Makes request to load in json
        expect(requests.length).toEqual(2);
        expect(requests[1].requestBody).toEqual(totalData);
        requests[1].respond(204, '', '');

        // Remote json is kept locally
        mongo.init.runInitializationScripts(dataObj.res_id, function () {});
        expect(requests.length).toEqual(3);
        expect(requests[2].requestBody).toEqual(totalData);
      });

      it('handles remote json without proper headers', function () {
        var remoteData = JSON.stringify({coll: [{data: 'remote'}]});
        var totalData = JSON.stringify({
          res_id: dataObj.res_id,
          collections: {coll: [{data: 'remote'}]}
        });
        shellElements[0].setAttribute('data-initialization-json', '/my/json/url');
        mongo.init.run();

        // Fetches remote json
        expect(requests.length).toEqual(1);
        expect(requests[0].url).toEqual('/my/json/url');
        requests[0].respond(200, null, remoteData);

        // Makes request to load in json
        expect(requests.length).toEqual(2);
        expect(requests[1].requestBody).toEqual(totalData);
      });

      it('only initializes if the resource id is new', function () {
        dataObj.is_new = false;
        shellElements[0].setAttribute('data-initialization-json', '{"test": "json"}');
        mongo.init.run();

        expect(requests.length).toEqual(0);
      });
    });
  });
});
