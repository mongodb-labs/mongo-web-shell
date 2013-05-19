/* global describe, expect, it, mongo */
describe('The const module', function () {
  it('stores keycode constants', function () {
    var key = mongo.const.keycodes;
    expect(key.enter).toBe(13);
    expect(key.left).toBe(37);
    expect(key.up).toBe(38);
    expect(key.right).toBe(39);
    expect(key.down).toBe(40);
  });

  it('stores the keep alive timeout', function () {
    expect(mongo.const.keepAliveTime).toBeDefined();
  });

  it('stores the root element CSS selector', function () {
    expect(mongo.const.rootElementSelector).toBeDefined();
  });

  it('stores the script name', function () {
    expect(mongo.const.scriptName).toBeDefined();
  });

  it('stores the shell batch size', function () {
    expect(mongo.const.shellBatchSize).toBeDefined();
  });
});
