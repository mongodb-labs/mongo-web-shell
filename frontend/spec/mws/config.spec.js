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

/* global describe, expect, it, mongo */
describe('The const module', function () {
  it('stores keycode constants', function () {
    var key = mongo.config.keycodes;
    expect(key.enter).toBe(13);
    expect(key.left).toBe(37);
    expect(key.up).toBe(38);
    expect(key.right).toBe(39);
    expect(key.down).toBe(40);
  });

  it('stores the keep alive timeout', function () {
    expect(mongo.config.keepAliveTime).toBeDefined();
  });

  it('stores the root element CSS selector', function () {
    expect(mongo.config.rootElementSelector).toBeDefined();
  });

  it('stores the script name', function () {
    expect(mongo.config.scriptName).toBeDefined();
  });

  it('stores the shell batch size', function () {
    expect(mongo.config.shellBatchSize).toBeDefined();
  });

  it('gets and stores the MWS host', function () {
    expect(mongo.config.mwsHost).toEqual('http://mwshost.example.com');
  });

  it('generates and stores the baseUrl', function(){
    expect(mongo.config.baseUrl).toBeDefined();
    expect(mongo.config.baseUrl.indexOf(mongo.config.mwsHost) > -1).toBe(true);
  });
});
