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
    var shellSpy, shellElements;

    beforeEach(function () {
      shellElements = [];
      for (var i = 0; i < SHELL_COUNT; i++) {
        var element = document.createElement('div');
        element.className = CONST.css.classes.root;
        document.body.appendChild(element);
        shellElements[i] = element;
      }
      shellSpy = jasmine.createSpyObj('Shell', [
        'attachClickListener',
        'attachInputHandler',
        'enableInput',
        'injectHTML',
        'keepAlive'
      ]);
      spyOn(mongo, 'Shell').andReturn(shellSpy);
    });

    afterEach(function () {
      shellElements.forEach(function (element) {
        element.parentNode.removeChild(element);
      });
      shellElements = null;
    });

    it('constructs a new shell', function () {
      mongo.init();
      expect(mongo.Shell.calls.length).toBe(SHELL_COUNT);
      shellElements.forEach(function (element, i) {
        expect(mongo.Shell).toHaveBeenCalledWith(element, i);
        expect(mongo.shells[i]).toBeDefined();
      });
      expect(shellSpy.injectHTML.calls.length).toBe(SHELL_COUNT);
      expect(shellSpy.attachClickListener.calls.length).toBe(SHELL_COUNT);
    });

    it('attaches and enables input handlers on mws resource creation',
        function () {
      // Unsuccessful creation.
      mongo.init();
      expect(shellSpy.attachInputHandler).not.toHaveBeenCalled();
      expect(shellSpy.enableInput).not.toHaveBeenCalled();
      jasmine.Clock.tick(mongo.const.keepAliveTime);
      expect(shellSpy.keepAlive).not.toHaveBeenCalled();

      creationSuccess = true;
      mongo.init();
      expect(shellSpy.attachInputHandler.calls.length).toBe(SHELL_COUNT);
      expect(shellSpy.attachInputHandler).toHaveBeenCalledWith(dataObj.res_id);
      expect(shellSpy.enableInput.calls.length).toBe(SHELL_COUNT);
      expect(shellSpy.enableInput).toHaveBeenCalledWith(true);
      jasmine.Clock.tick(mongo.const.keepAliveTime - 1);
      expect(shellSpy.keepAlive).not.toHaveBeenCalled();
      jasmine.Clock.tick(1);
      expect(shellSpy.keepAlive).toHaveBeenCalled();
    });
  });
});
