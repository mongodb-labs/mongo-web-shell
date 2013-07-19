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
            create_new: false,
            init_data: true,
            init_url: arguments[1]
          });
          break;

        case 'loadJSON':
          // loads data from json into first selected shell
          mongo.init._initShell(this[0], mongo.init.res_id, {
            create_new: false,
            init_data: true,
            init_json: arguments[1]
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
        this.addClass('mongo-web-shell').each(function(i, e){
          // determine the initialization options for the current shell
          // preferring undefined over null prevents null properties from overwriting defaults
          var opt = $.extend({}, $.mws.defaults, {
            init_url: $(e).data('initialization-url') || undefined,
            init_json: $(e).data('initialization-json') || undefined
          }, options);

          mongo.init._initShell(e, mongo.init.res_id, opt);
        });

        options = $.extend({}, $.mws.defaults, options);

        if (options.height){ this.height(options.height); }
        if (options.width){ this.width(options.width); }
        break;

      default:
        throw new TypeError('Parameter must be a string or options object');
      }
      return this;
    }
  });

  $.mws = {
    defaults: {
      create_new: true,
      init_data: true,
      init_url: undefined,
      init_json: undefined,
      height: undefined,
      width: undefined
    },

    setDefaults: function(options){
      return $.extend($.mws.defaults, options);
    }
  };
};
