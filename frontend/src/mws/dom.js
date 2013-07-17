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

/* global mongo */
mongo.dom = (function () {
  // TODO: Should each shell be able to have its own host?
  // Default config values.
  var CSS_PATH = 'mongoWebShell.css';
  var MWS_HOST = '';

  function retrieveConfig() {
    var $curScript = $('script[src*=\'' + mongo.const.scriptName + '\']');
    var mwsHost = $curScript.data('mws-host') || MWS_HOST;
    return {
      cssPath: $curScript.data('css-path') || CSS_PATH,
      mwsHost: mwsHost,
      baseUrl: mwsHost + '/mws/'
    };
  }

  function injectStylesheet(cssPath) {
    var linkElement = document.createElement('link');
    linkElement.href = cssPath;
    linkElement.rel = 'stylesheet';
    linkElement.type = 'text/css';
    $('head').prepend(linkElement); // Prepend so css can be overridden.
  }

  return {
    retrieveConfig: retrieveConfig,
    injectStylesheet: injectStylesheet
  };
}());
