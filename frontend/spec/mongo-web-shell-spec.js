/* global afterEach, beforeEach, describe, expect, it, mongo, sinon */
/* global xdescribe, xit */
$.ready = function () {}; // Prevent mongo.init() from running.

var CONST = {
  css: {
    file: 'mongo-web-shell.css',
    classes: {
      root: '.mongo-web-shell',
      internal: [
        '.mws-border',
        '.mshell',
        '.mws-in-shell-response',
        '.mws-input'
      ]
    }
  }
};


xdescribe('The init function', function () {
  // TODO: The calls made in mongo.init() need to be stubbed; there should be
  // no side effects to the page (alternatively, have side effects but restore
  // the page to the initial state on afterEach()). Then re-enable this.
  var xhr, requests;

  beforeEach(function () {
    xhr = sinon.useFakeXMLHttpRequest();
    requests = [];
    xhr.onCreate = function (req) { requests.push(req); };
  });

  afterEach(function () {
    xhr.restore();
  });

  xit('makes a post request for todo items', function () {
    mongo.init(sinon.spy());
    expect(requests.length).toBe(1);
    expect(requests[0].url).toBe('/mws/');
  });
});


describe('The const module', function () {
  it('stores keycode constants', function () {
    var key = mongo.const.keycodes;
    expect(key.enter).toBe(13);
    expect(key.left).toBe(37);
    expect(key.up).toBe(38);
    expect(key.right).toBe(39);
    expect(key.down).toBe(40);
  });
});


describe('A Cursor', function () {
  // TODO: Test.
});


describe('The dom module', function () {
  it('retrives the shell configuration from the DOM', function () {
    // TODO: Test more than the default values.
    var config = mongo.dom.retrieveConfig();
    // Default values.
    expect(config.cssPath).toBe(CONST.css.file);
    expect(config.mwsHost).toBe('');
    expect(config.baseUrl).toBe('/mws/');
  });

  it('injects a stylesheet into the DOM', function () {
    function expectAbsentCSS(cssFile) {
      $('link').each(function (index, linkElement) {
        expect(linkElement.href).not.toBe(cssFile);
      });
    }

    // TODO: Should the dom methods be stubbed instead?
    expectAbsentCSS(CONST.css.file);
    mongo.dom.injectStylesheet(CONST.css.file);
    var injected = $('head').children().get(0); // Expect to be prepended.
    expect(injected.tagName).toBe('LINK');
    expect(injected.href).toMatch(CONST.css.file + '$');
    expect(injected.rel).toBe('stylesheet');
    expect(injected.type).toBe('text/css');

    // Clean up.
    injected.parentNode.removeChild(injected);
    expectAbsentCSS(CONST.css.file);
  });
});


describe('The keyword module', function () {
  it('uses use,help,show to switch what function to call', function () {
      var help = sinon.stub();
      var show = sinon.stub();
      var it = sinon.stub();
      var words = ['use','it','help','show'];
      var arg = [0,'arg', 'arg2', 'unusedArg',undefined];

      function Shell() {
        this.insertResponseLine = sinon.stub();
      }
      mongo.keyword.shell = new Shell();

      function spies(i) {
        if(i === 0)
          return mongo.keyword.use;
        if(i === 1)
          return mongo.keyword.it;
        if(i === 2)
          return mongo.keyword.help;
        if(i === 3)
          return mongo.keyword.show;
      }

      for (var i = 0;i<1;i++) {
        spyOn(mongo.keyword, words[i]);
        mongo.keyword.evaluate(arg[0], words[i], arg[1], arg[2], arg[3] );
        if( i !== 1) {
          if(i === 0)
            expect(spies(i)).toHaveBeenCalledWith(arg[4],arg[1],arg[2],arg[3]);
          else
            expect(spies(i)).not.toHaveBeenCalled();
          mongo.keyword.evaluate(arg[0], words[i], arg[1], arg[2]);
          expect(spies(i)).toHaveBeenCalledWith(arg[4],arg[1],arg[2],arg[4]);
        }
        else {
          expect(spies(i)).toHaveBeenCalledWith(arg[4]);
        }
      }
      spyOn(mongo.keyword.shell,'insertResponseLine');
      mongo.keyword.evaluate(arg[0], 'a', arg[1], arg[2], arg[3]);
      var res = 'Unknown keyword: a.';
      expect(mongo.keyword.shell.insertResponseLine).toHaveBeenCalledWith(res);
      mongo.keyword.evaluate(arg[0], 'b', arg[1], arg[2]);
      res = 'Unknown keyword: b.';
      expect(mongo.keyword.shell.insertResponseLine).toHaveBeenCalledWith(res);
    });

  it('help function', function(){
    // TODO: Wait for javascript to be implemented.
  });

  it('it function', function() {
    var it = mongo.keyword.it;
    function Shell() {
        this.insertResponseLine = sinon.stub();
      }
    var shell = new Shell();
    spyOn(shell,'insertResponseLine');
    it(shell);
    expect(shell.insertResponseLine).toHaveBeenCalledWith('no cursor');

    function Cursor() {
        this.hasNext = sinon.stub().returns(true);
        this._printBatch = sinon.stub();
      }

    shell.lastUsedCursor = new Cursor();
    spyOn(shell.lastUsedCursor,'_printBatch');
    expect(shell.lastUsedCursor._printBatch).not.toHaveBeenCalled();
    it(shell);
    expect(shell.lastUsedCursor._printBatch).toHaveBeenCalled();
    expect(shell.insertResponseLine.calls.length).toEqual(1);
  });
});


describe('The mutateSource module', function () {
  // TODO: Test.
});


describe('A Query', function () {
  // TODO: Test.
});


describe('A Readline instance', function () {
  // TODO: Test.
});


describe('The request module', function () {
  // TODO: Test untested methods.
  describe('relying on mongo.config', function () {
    var configStore;

    beforeEach(function () {
      configStore = mongo.config;
      mongo.config = {};
    });

    afterEach(function () {
      mongo.config = configStore;
    });

    it('creates a resource URL from the given parameters', function () {
      var gru = mongo.request._getResURL;
      mongo.config = {baseUrl: '/kpop/'};
      expect(gru('iu', 'jjang')).toBe('/kpop/iu/db/jjang/');
      mongo.config = {baseUrl: 'mws/'};
      expect(gru(30, 2)).toBe('mws/30/db/2/');
      expect(gru(null)).toBe('mws/null/db/undefined/');
      mongo.config = {baseUrl: 123};
      expect(gru('a', 'b')).toBe('123a/db/b/');
    });
  });

  it('prunes the given keys from the given object if undefined or null',
      function () {
    function Parent() {
      this.a = 'a';
      this.b = null;
    }
    function Child(y, z) {
      this.y = y;
      this.z = z;
    }
    Child.prototype = Parent;

    var keysToDelete = ['b', 'z'];
    var actual = [
      {b: 'b', z: 'z'}, // 0
      {a: 'a', b: undefined, y: undefined, z: null}, // 1
      {a: 'a'}, // 2
      {}, // 3
      new Parent(), // 4
      new Child('y', 'z'), // 5
      new Child('y') // 6
    ];
    var expected = [
      {b: 'b', z: 'z'}, // 0
      {a: 'a', y: undefined}, // 1
      {a: 'a'}, // 2
      {} // 3
    ];
    var tmp = new Parent();
    delete tmp.b;
    expected.push(tmp);  // 4
    expected.push(new Child('y', 'z')); // 5
    tmp = new Child('y');
    delete tmp.z;
    expected.push(tmp); // 6

    actual.forEach(function (obj, i) {
      mongo.request._pruneKeys(obj, keysToDelete);
      expect(obj).toEqual(expected[i]);
    });
    actual = {a: 'a', b: 'b'};
    mongo.request._pruneKeys(actual, []);
    expect(actual).toEqual({a: 'a', b: 'b'});
  });

  it('stringifies the keys of the given object', function () {
    var js = JSON.stringify;
    var actual =  [
      {str: 'a', number: 0, obj: {key: 'val'}},
      {}
    ];
    var expected = [
      {str: js('a'), number: js(0), obj: JSON.stringify({key: 'val'})},
      {}
    ];
    actual.forEach(function (obj, i) {
      mongo.request._stringifyKeys(obj);
      expect(obj).toEqual(expected[i]);
    });
  });
});


describe('A Shell', function () {
  // TODO: Test untested methods.
  // TODO: Embed a describe that injects for multiple shells in setup.
  var shells;
  var rootElements;
  var SHELL_COUNT = 2;

  beforeEach(function () {
    shells = [];
    rootElements = [];
    for (var i = 0; i < SHELL_COUNT; i++) {
      var div = document.createElement('div');
      div.className = CONST.css.classes.root;
      document.body.appendChild(div);
      shells.push(new mongo.Shell(div, i));
      rootElements.push(div);
    }
  });

  afterEach(function () {
    while (rootElements.length > 0) {
      var element = rootElements.pop();
      element.parentNode.removeChild(element);
    }
    shells = null;
    rootElements = null;
  });

  it('injects its HTML into the DOM', function () {
    function expectInternalLength(len) {
      CONST.css.classes.internal.forEach(function (cssClass) {
        var $element = $(cssClass);
        expect($element.length).toBe(len);
      });
    }

    expectInternalLength(0);
    shells.forEach(function (shell, i) {
      shell.injectHTML();
      expectInternalLength(i + 1);
    });
  });
});


describe('The util module', function () {
  it('divides source code into statements based on range indicies',
      function () {
    var expected, sourceArr;
    expected = sourceArr = [
      'db.inventory.find({qty: 50});',
      'note that this does not need to be syntactically valid',
      ''
    ];
    var source = sourceArr.join('');

    var ast = {body: []};
    var startInd = 0, endInd;
    sourceArr.forEach(function (statement) {
      endInd = startInd + statement.length;
      ast.body.push({range: [startInd, endInd]});
      startInd = endInd;
    });

    var statements = mongo.util.sourceToStatements(source, ast);
    statements.forEach(function (statement, i) {
      expect(statement).toBe(expected[i]);
    });
  });
});
