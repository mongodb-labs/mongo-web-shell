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
          initUrl: '/init/url'
        }));
      });

      it('specifying the json url', function(){
        shellElement.data('initialization-json', '/init/json/url');
        var e = $('.mongo-web-shell').mws();
        expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', $.extend(expectedOptions, {
          initJSON: '/init/json/url'
        }));
      });

      it('specifying inline json', function(){
        shellElement.data('initialization-json', '{a:1}');
        var e = $('.mongo-web-shell').mws();
        expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', $.extend(expectedOptions, {
          initJSON: '{a:1}'
        }));
      });
    });

    it('with custom parameters', function(){
      var opt = {
        createNew: false,
        initData: false,
        initUrl: '/init/url',
        initJSON: '/init/json/url'
      }, e = $('.mongo-web-shell').mws(opt);
      expect(initShell).toHaveBeenCalledWith(e[0], 'res_id', $.extend(expectedOptions, opt));
    });

    it('and save data parameters for re-initialization', function(){
      $('.mongo-web-shell').mws({
        createNew: false,
        initData: false,
        initUrl: '/init/url',
        initJSON: '/init/json/url'
      });

      expect(shellElement.data('initialization-url')).toEqual('/init/url');
      expect(shellElement.data('initialization-json')).toEqual('/init/json/url');
    });

    it('with a specified height', function(){
      $('.mongo-web-shell').mws({height: 100});
      expect(shellElement.height()).toBe(100);
    });

    it('with a specified width', function(){
      $('.mongo-web-shell').mws({width: 100});
      expect(shellElement.width()).toBe(100);
    });

    it('and return the jQuery object', function(){
      var jq = $('.mongo-web-shell');
      expect(jq.mws()).toBe(jq);
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

    it('locking it and returning the jQuery object', function(){
      expect(shell.$input.prop('disabled')).toBe(false);
      expect($shell.mws('lock')).toBe($shell);
      expect(shell.$input.prop('disabled')).toBe(true);
    });

    it('unlocking it and returning the jQuery object', function(){
      shell.$input.prop('disabled', true);
      expect($shell.mws('unlock')).toBe($shell);
      expect(shell.$input.prop('disabled')).toBe(false);
    });

    it('setting the width and returning the jQuery object', function(){
      expect($shell.mws('width', 100)).toBe($shell);
      expect($shell.width()).toBe(100);
    });

    it('setting the height and returning the jQuery object', function(){
      expect($shell.mws('height', 100)).toBe($shell);
      expect($shell.height()).toBe(100);
    });

    it('loading data from a url and returning the jQuery object', function(){
      var initShell = spyOn(mongo.init, '_initShell');
      expect($shell.mws('loadUrl', '/my/data/url')).toBe($shell);
      expect(initShell).toHaveBeenCalledWith($shell[0], 'res_id', {
        createNew: false,
        initData: true,
        initUrl: '/my/data/url'
      });
    });

    it('loading data from json and returning the jQuery object', function(){
      var initShell = spyOn(mongo.init, '_initShell');
      expect($shell.mws('loadJSON', {coll: [{a: 1}]})).toBe($shell);
      expect(initShell).toHaveBeenCalledWith($shell[0], 'res_id', {
        createNew: false,
        initData: true,
        initJSON: {coll: [{a: 1}]}
      });
    });

    it('loading data from a json url and returning the jQuery object', function(){
      var initShell = spyOn(mongo.init, '_initShell');
      expect($shell.mws('loadJSON', '/my/json/url')).toBe($shell);
      expect(initShell).toHaveBeenCalledWith($shell[0], 'res_id', {
        createNew: false,
        initData: true,
        initJSON: '/my/json/url'
      });
    });

    it('setting its input and returning the jQuery object', function(){
      expect($shell.mws('input', 'command')).toBe($shell);
      expect(shell.$input.val()).toEqual('command');
    });

    it('submitting its input and returning the jQuery object', function(){
      spyOn(shell, 'handleInput');
      expect($shell.mws('submit')).toBe($shell);
      expect(shell.handleInput).toHaveBeenCalled();
    });

    describe('sending output and returning the jQuery object', function(){
      it('printing a single line', function(){
        spyOn(shell, 'insertResponseLine');
        expect($shell.mws('output', 'response')).toBe($shell);
        expect(shell.insertResponseLine).toHaveBeenCalledWith('response');
      });

      it('printing multiple line and returning the jQuery object', function(){
        spyOn(shell, 'insertResponseArray');
        expect($shell.mws('output', ['1', '2', '3'])).toBe($shell);
        expect(shell.insertResponseArray).toHaveBeenCalledWith(['1', '2', '3']);
      });
    });
  });

  it('have configurable defaults', function(){
    var opt = {
      initData: false,
      initUrl: '/init/url',
      initJSON: '/init/json/url'
    };
    $.mws.setDefaults(opt);
    expect($.mws.defaults).toEqual($.extend({createNew: true}, opt));
  });
});
