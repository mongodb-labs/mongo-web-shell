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
/* global mongo */
// set up $.mws
mongo.jQueryInit = function($){
  $.fn.extend({
    mws: function(options){
      switch (typeof options){
      case 'string':
        // manipulate properties of existing shell
        switch (options){
        case 'lock':
          this.each(function(i, e){ $(e).data('shell').enableInput(false); });
          break;

        case 'unlock':
          this.each(function(i, e){ $(e).data('shell').enableInput(true); });
          break;

        case 'width':
          this.width(arguments[1]);
          break;

        case 'height':
          this.height(arguments[1]);
          break;

        case 'loadUrl':
          // loads data from url into first selected shell
          mongo.init._initShell(this[0], mongo.init.res_id, {
            createNew: false,
            initData: true,
            initUrl: arguments[1]
          });
          break;

        case 'loadJSON':
          // loads data from json into first selected shell
          mongo.init._initShell(this[0], mongo.init.res_id, {
            createNew: false,
            initData: true,
            initJSON: arguments[1]
          });
          break;

        case 'input':
          var val = arguments[1];
          this.each(function(i, e){
            $(e).data('shell').$input.val(val);
          });
          break;

        case 'submit':
          this.each(function(i, e){ $(e).data('shell').handleInput(); });
          break;

        case 'output':
          var vals = arguments[1];
          if ($.isArray(vals)){
            this.each(function(i, e){ $(e).data('shell').insertResponseArray(vals); });
          } else {
            this.each(function(i, e){ $(e).data('shell').insertResponseLine(vals); });
          }
          break;
        }
        break;

      case 'object':
      case 'undefined': // accept no parameters as call to default constructor
        options = $.extend({}, $.mws.defaults, options);
        this.addClass('mongo-web-shell').each(function(i, e){
          var $e = $(e);

          // do not reinitialize existing shells, fail silently
          if ($e.data('shell')){
            return;
          }

          var opt = $.extend({}, options); // copy options
          if (opt.initUrl){
            $e.data('initialization-url', options.initUrl);
          } else {
            opt.initUrl = $e.data('initialization-url');
          }

          if (opt.initJSON){
            $e.data('initialization-json', options.initJSON);
          } else {
            opt.initJSON = $e.data('initialization-json');
          }

          mongo.init._initShell(e, mongo.init.res_id, opt);

          if (options.height){ $e.height(options.height); }
          if (options.width){ $e.width(options.width); }
        });
        break;

      default:
        throw new TypeError('Parameter must be a string or options object');
      }
      return this;
    }
  });

  $.mws = {
    defaults: {
      createNew: true,
      initData: true,
      initUrl: undefined,
      initJSON: undefined,
      height: undefined,
      width: undefined
    },

    setDefaults: function(options){
      return $.extend($.mws.defaults, options);
    }
  };
};
