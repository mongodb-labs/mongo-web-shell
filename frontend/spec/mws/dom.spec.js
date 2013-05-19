/* global CONST, describe, expect, it, mongo */
describe('The dom module', function () {
  var dataAttrKeys = CONST.domConfig.dataAttrKeys;
  var defaults = CONST.domConfig.defaults;

  it('retrives the shell configuration from the DOM', function () {
    var actual = mongo.dom.retrieveConfig();
    expect(actual.cssPath).toBe(defaults.cssPath);
    expect(actual.mwsHost).toBe(defaults.mwsHost);
    expect(actual.baseUrl).toBe(defaults.mwsHost + defaults.baseUrlPostfix);

    var expected = {cssPath: 'css', mwsHost: 'host'};
    expected.baseUrl = expected.mwsHost + defaults.baseUrlPostfix;
    var $script = $('script[src*=\'' + CONST.scriptName + '\']');
    var key;
    for (key in dataAttrKeys) {
      if (dataAttrKeys.hasOwnProperty(key)) {
        $script.data(dataAttrKeys[key], expected[key]);
      }
    }
    actual = mongo.dom.retrieveConfig();
    for (key in expected) {
      if (expected.hasOwnProperty(key)) {
        expect(actual[key]).toBe(expected[key]);
      }
    }
  });

  it('injects a stylesheet into the DOM', function () {
    function expectAbsentCSS(cssFile) {
      $('link').each(function (index, linkElement) {
        expect(linkElement.href).not.toBe(cssFile);
      });
    }

    expectAbsentCSS(defaults.cssPath);
    mongo.dom.injectStylesheet(defaults.cssPath);
    var injected = $('head').children().get(0); // Expect to be prepended.
    expect(injected.tagName).toBe('LINK');
    expect(injected.href).toMatch(defaults.cssPath + '$');
    expect(injected.rel).toBe('stylesheet');
    expect(injected.type).toBe('text/css');

    // Clean up.
    injected.parentNode.removeChild(injected);
    expectAbsentCSS(defaults.cssPath);
  });
});
