/* jshint camelcase: false */
/* global afterEach, beforeEach, CONST, describe, expect, it, jasmine, mongo */
/* global spyOn */
describe('The init function', function () {
  var creationSuccess, dataObj = {res_id: 'iu'};
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
  });

  afterEach(function () {
    mongo.config = null;
    mongo.shells = [];
  });

  it('enables console protection', function () {
    mongo.init();
    expect(mongo.dom.retrieveConfig).toHaveBeenCalled();
  });

  it('retrieves and sets the script configuration', function () {
    mongo.init();
    expect(mongo.dom.retrieveConfig).toHaveBeenCalled();
    expect(mongo.config).toEqual(expected.config);
  });

  it('injects the web shell stylesheet', function () {
    mongo.init();
    expect(mongo.dom.injectStylesheet).toHaveBeenCalledWith(
        expected.config.cssPath);
  });

  describe('for each web shell div in the DOM', function () {
    var SHELL_COUNT = 3;
    var shellElements;

    beforeEach(function () {
      shellElements = [];
      for (var i = 0; i < SHELL_COUNT; i++) {
        var element = $('<div class=' + CONST.rootClass + '/>');
        $('body').append(element);
        shellElements.push(element.get(0));
      }
    });

    afterEach(function () {
      $('.' + CONST.rootClass).remove();
    });

    it('constructs a new shell', function () {
      spyOn(mongo, 'Shell');

      mongo.init();
      expect(mongo.Shell.calls.length).toBe(SHELL_COUNT);
      shellElements.forEach(function (element, i) {
        expect(mongo.Shell).toHaveBeenCalledWith(element, i);
      });
    });

    it('attaches and enables input handlers on mws resource creation', function () {
      var attachInputHandler = spyOn(mongo.Shell.prototype, 'attachInputHandler');
      var keepAlive = spyOn(mongo.request, 'keepAlive');

      // Unsuccessful creation.
      mongo.init();
      expect(attachInputHandler).not.toHaveBeenCalled();
      jasmine.Clock.tick(mongo.const.keepAliveTime);
      expect(keepAlive).not.toHaveBeenCalled();

      creationSuccess = true;
      mongo.init();
      expect(attachInputHandler.calls.length).toBe(SHELL_COUNT);
      expect(attachInputHandler).toHaveBeenCalledWith(dataObj.res_id);
      jasmine.Clock.tick(mongo.const.keepAliveTime - 1);
      expect(keepAlive).not.toHaveBeenCalled();
      jasmine.Clock.tick(1);
      expect(keepAlive).toHaveBeenCalled();
    });
  });
});
