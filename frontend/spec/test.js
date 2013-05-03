$.fn.ready = function() {
    describe('Mongo Const Module', function() {
        it('set const keycodes', function() {
            var enter = mongo.const.keycodes.enter;
            var left = mongo.const.keycodes.left;
            var up = mongo.const.keycodes.up;
            var right = mongo.const.keycodes.right;
            var down = mongo.const.keycodes.down;
            expect(enter).toEqual(13);
            expect(left).toEqual(37);
            expect(up).toEqual(38);
            expect(right).toEqual(39);
            expect(down).toEqual(40);
          });
      });

    describe('Mongo Dom Module', function() {
      it('retrives config', function() {
        var config = mongo.dom.retrieveConfig();
        expect(config.cssPath).toEqual('mongo-web-shell.css');
        expect(config.mwsHost).toEqual('');
        expect(config.baseUrl).toEqual('/mws/');
      });

      it('inject CSS', function() {
        var link = document.getElementsByTagName('link');
        var linkElement;
        var href;

        if(link.length!==0) {
          linkElement = document.getElementsByTagName('link')[0];
          href = linkElement.getAttribute('href');
          expect(href).toNotEqual('mongo-web-shell.css');
        }

        mongo.dom.injectStylesheet('mongo-web-shell.css');
        linkElement = document.getElementsByTagName('link')[0];
        href = linkElement.getAttribute('href');
        var rel = linkElement.getAttribute('rel');
        var type = linkElement.getAttribute('type');
        expect(href).toEqual('mongo-web-shell.css');
        expect(rel).toEqual('stylesheet');
        expect(type).toEqual('text/css');
      });
    });


    describe('Mwshell module', function() {
      it('injects HTML', function() {
        var mwsBorder = $('.mws-border');
        expect(mwsBorder.length).toEqual(0);
        var shell = new MWShell($('.mongo-web-shell'));
        shell.injectHTML();
        mwsBorder = $('.mws-border');
        expect(mwsBorder.length).toEqual(1);
        expect(mwsBorder.find('.mshell').length).toEqual(1);
        expect(mwsBorder.find('.mshell').find('.mws-input').length).toEqual(1);
      });
    });

    describe('MONGO mutateSource', function() {
      it('check keywords', function() {
        expect(mongo.mutateSource._isKeyword('help')).toEqual(true);
        expect(mongo.mutateSource._isKeyword('show')).toEqual(true);
        expect(mongo.mutateSource._isKeyword('use')).toEqual(true);
        expect(mongo.mutateSource._isKeyword('flase')).not.toBeDefined();
      });
    });

    describe('MONGO request', function() {
      it('get result url with parameters resID and collection', function() {
        mongo.config.baseUrl = '/mws/';
        expect(mongo.request._getResURL(30,2)).toEqual('/mws/30/db/2/');
      });

      it('pruneKeys', function() {
        function Param (db,query,projection){
          this.db = db;
          this.query = query;
          this.projection = projection;
        }
        var param = [new Param(0,null,0),new Param(0,0,undefined),
                     new Param(0,undefined,null),new Param(0,0,0)];
        var keys = ['query','projection'];
        for(var i in param) {
          mongo.request._pruneKeys(param[i],keys);
        }
        expect(Object.keys(param[0]).length).toBe(2);
        expect(Object.keys(param[1]).length).toBe(2);
        expect(Object.keys(param[2]).length).toBe(1);
        expect(Object.keys(param[3]).length).toBe(3);
      });

      it('stringifyKeys', function() {
        var a = {'a':{1:2}};
        var res = {'a':'{"1":2}'};
        mongo.request._stringifyKeys(a);
        expect(a).toEqual(res);
      });
    });

    describe('mongo util module', function() {
      it('uses indices to divide source returns statements as an array',
        function() {
          var ast = new Object();
          var str0 = 'db.inventory.find( { qty: 50 } )';
          var str1 = 'db.collection.totalSize()';
          var str2 = 'db.products.update( { item: "book", qty: { $gt: 5 } } )';
          var src  = str0 + str1 + str2;
          var params  = new Object();
          var params1 = new Object();
          var params2 = new Object();
          ast.body = [];
          params.range  = {0:0,1:str0.length};
          params1.range = {0:str0.length,1:str0.length+str1.length};
          params2.range = {0:str0.length+str1.length,1:(src.length)};
          ast.body.push(params);
          ast.body.push(params1);
          ast.body.push(params2);
          var statements = mongo.util.sourceToStatements(src,ast);
          expect(statements[0]).toEqual(str0);
          expect(statements[1]).toEqual(str1);
          expect(statements[2]).toEqual(str2);
        });
    });
    describe('MONGO init', function() {
      var xhr, requests;

      beforeEach(function () {
        xhr = sinon.useFakeXMLHttpRequest();
        requests = [];
        xhr.onCreate = function (req) { requests.push(req); };
      });

      afterEach(function () {
        xhr.restore();
      });

      it('makes a post request for todo items', function () {
        mongo.init(sinon.spy());
        expect(requests.length).toEqual(1);
        expect(requests[0].url).toEqual('/mws/');
      });
    });
  };
