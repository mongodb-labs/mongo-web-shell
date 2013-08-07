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

/* exported CONST, MWS_HOST */
/**
 * This file contains various global variables that are used throughout
 * testing.
 */
$.ready = function () {}; // Prevent mongo.init.run() from running.

var MWS_HOST = 'http://mwshost.example.com';

var CONST = {
  css: {
    classes: {
      root: 'mongo-web-shell',
      internal: [
        'mws-response-list',
        'mws-input-li',
        'mws-form',
        'mws-input'
      ],
      responseList: 'mws-response-list'
    }
  },
  domConfig: {
    dataAttrKeys: {
      cssPath: 'css-path',
      mwsHost: 'mws-host'
    },
    defaults: {
      cssPath: 'mongoWebShell.css',
      mwsHost: '',
      baseUrlPostfix: '/mws/'
    }
  },
  scriptName: 'mongoWebShell.js'
};
