/* jshint camelcase: false */
/* global afterEach, beforeEach, describe, expect, it, mongo, spyOn */
describe('The jQuery methods', function(){
  describe('construct an instance of the web shell', function(){
    var initShell, shellElement, expectedOptions;
    beforeEach(function(){
      initShell = spyOn(mongo.init, '_initShell');
      mongo.init.res_id = 'res_id';
      shellElement = $('<div class="mongo-web-shell" />').appendTo(document.body);

      expectedOptions = $.extend(true, {}, $.mws.defaults);
      for (var prop in expectedOptions){
        if (expectedOptions[prop] === undefined) { delete expectedOptions[prop]; }
      }
    });

    afterEach(function(){
      shellElement.remove();
    });

    it('from a single container', function(){
      var e = $('.mongo-web-shell').first().mws();

      expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', expectedOptions);
    });

    it('from multiple containers', function(){
      $(document.body).append('<div class="mongo-web-shell" />');

      var e = $('.mongo-web-shell').mws();
      expect(e.length).toBe(2);

      expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', expectedOptions);
      expect(initShell).toHaveBeenCalledWith(e[1], 'res_id', expectedOptions);

      e.remove();
    });

    describe('with data attributes', function(){
      it('specifying the init url', function(){
        shellElement.data('initialization-url', '/init/url');
        var e = $('.mongo-web-shell').mws();
        expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', $.extend(expectedOptions, {
          init_url: '/init/url'
        }));
      });

      it('specifying the json url', function(){
        shellElement.data('initialization-json', '/init/json/url');
        var e = $('.mongo-web-shell').mws();
        expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', $.extend(expectedOptions, {
          init_json: '/init/json/url'
        }));
      });

      it('specifying inline json', function(){
        shellElement.data('initialization-json', '{a:1}');
        var e = $('.mongo-web-shell').mws();
        expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', $.extend(expectedOptions, {
          init_json: '{a:1}'
        }));
      });
    });

    it('with custom parameters', function(){
      var opt = {
        create_new: false,
        init_data: false,
        init_url: '/init/url',
        init_json: '/init/json/url'
      }, e = $('.mongo-web-shell').mws(opt);
      expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', $.extend(expectedOptions, opt));
    });

    it('with a specified height', function(){
      $('.mongo-web-shell').mws({height: 100});
      expect(shellElement.height()).toBe(100);
    });

    it('with a specified width', function(){
      $('.mongo-web-shell').mws({width: 100});
      expect(shellElement.width()).toBe(100);
    });
  });

  describe('manipulate an existing web shell by', function(){
    var $shell, shell;
    beforeEach(function(){
      mongo.init.res_id = 'res_id';
      $shell = $('<div />').appendTo(document.body).mws();
      shell = $shell.data('shell');
    });

    afterEach(function(){
      $shell.remove();
    });

    it('locking it', function(){
      expect(shell.$input[0].disabled).toBe(false);
      $shell.mws('lock');
      expect(shell.$input[0].disabled).toBe(true);
    });

    it('unlocking it', function(){
      shell.$input[0].disabled = true;
      $shell.mws('unlock');
      expect(shell.$input[0].disabled).toBe(false);
    });

    it('setting the width', function(){
      $shell.mws('width', 100);
      expect($shell.width()).toBe(100);
    });

    it('setting the height', function(){
      $shell.mws('height', 100);
      expect($shell.height()).toBe(100);
    });

    it('loading data from a url', function(){
      var initShell = spyOn(mongo.init, '_initShell');
      $shell.mws('loadUrl', '/my/data/url');
      expect(initShell).toHaveBeenCalledWith($shell[0], 'res_id', {
        create_new: false,
        init_data: true,
        init_url: '/my/data/url'
      });
    });

    it('loading data from json', function(){
      var initShell = spyOn(mongo.init, '_initShell');
      $shell.mws('loadJSON', {coll: [{a: 1}]});
      expect(initShell).toHaveBeenCalledWith($shell[0], 'res_id', {
        create_new: false,
        init_data: true,
        init_json: {coll: [{a: 1}]}
      });
    });

    it('loading data from a json url', function(){
      var initShell = spyOn(mongo.init, '_initShell');
      $shell.mws('loadJSON', '/my/json/url');
      expect(initShell).toHaveBeenCalledWith($shell[0], 'res_id', {
        create_new: false,
        init_data: true,
        init_json: '/my/json/url'
      });
    });

    it('setting its input', function(){
      $shell.mws('input', 'command');
      expect(shell.$input.val()).toEqual('command');
    });

    it('submitting its input', function(){
      spyOn(shell, 'handleInput');
      $shell.mws('submit');
      expect(shell.handleInput).toHaveBeenCalled();
    });

    describe('sending output', function(){
      it('printing a single line', function(){
        spyOn(shell, 'insertResponseLine');
        $shell.mws('output', 'response');
        expect(shell.insertResponseLine).toHaveBeenCalledWith('response');
      });

      it('printing multiple line', function(){
        spyOn(shell, 'insertResponseArray');
        $shell.mws('output', ['1', '2', '3']);
        expect(shell.insertResponseArray).toHaveBeenCalledWith(['1', '2', '3']);
      });
    });
  });

  it('have configurable defaults', function(){
    var opt = {
      init_data: false,
      init_url: '/init/url',
      init_json: '/init/json/url'
    };
    $.mws.setDefaults(opt);
    expect($.mws.defaults).toEqual($.extend({create_new: true}, opt));
  });
});
