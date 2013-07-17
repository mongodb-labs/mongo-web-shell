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

// See: https://github.com/ariya/phantomjs/issues/10522
// Fix via:
// https://developer.mozilla.org/en-US/docs/JavaScript/Reference/
//     Global_Objects/Function/bind
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== 'function') {
      // closest thing possible to the ECMAScript 5 internal IsCallable func.
      throw new TypeError('Function.prototype.bind - what is trying to be ' +
          'bound is not callable');
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), fToBind = this,
        FNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof FNOP &&
              oThis ? this : oThis, aArgs.concat(Array.prototype.slice.call(
                  arguments)));
        };

    FNOP.prototype = this.prototype;
    fBound.prototype = new FNOP();

    return fBound;
  };
}
