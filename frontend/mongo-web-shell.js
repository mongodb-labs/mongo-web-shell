/* jshint camelcase: false, unused: false */
var mongo = {};

// Protect older browsers from an absent console.
if (!console || !console.log) { var console = { log: function () {} }; }
if (!console.debug || !console.error || !console.info || !console.warn) {
  console.debug = console.error = console.info = console.warn = console.log;
}

/**
 * Injects a mongo web shell into the DOM wherever an element of class
 * 'mongo-web-shell' can be found. Additionally sets up the resources
 * required by the web shell, including the mws REST resource and the mws
 * CSS stylesheets.
 */
mongo.init = function () {
  var config = mongo.dom.retrieveConfig();
  mongo.dom.injectStylesheet(config.cssPath);
  $('.mongo-web-shell').each(function (index, shellElement) {
    var shell = new MWShell(shellElement);
    shell.injectHTML();

    // Attempt to create MWS resource on remote server.
    $.post(config.baseUrl, null, function (data, textStatus, jqXHR) {
      if (!data.res_id) {
        // TODO: Print error in shell. Improve error below.
        console.warn('No res_id received! Shell disabled.', data);
        return;
      }
      console.info('/mws/' + data.res_id, 'was created succssfully.');
      shell.attachInputHandler(data.res_id);
      shell.enableInput(true);
    },'json').fail(function (jqXHR, textStatus, errorThrown) {
      // TODO: Display error message in the mongo web shell.
      console.error('AJAX request failed:', textStatus, errorThrown);
    });
    //focus on input on click
    jQuery(shell.$rootElement.find('.mws-body').get(0)).click(function() {
      jQuery(shell.$input).focus();
    });
  });
};

mongo.dom = (function () {
  // TODO: Document these data attributes.
  // TODO: Should each shell be able to have its own host?
  // Default config values.
  var CSS_PATH = 'mongo-web-shell.css';
  var MWS_HOST = 'http://localhost:5000';
  var BASE_URL = MWS_HOST + '/mws';

  function retrieveConfig() {
    var $curScript = $('script').last();
    return {
      cssPath: $curScript.data('css-path') || CSS_PATH,
      mwsHost: $curScript.data('mws-host') || MWS_HOST,
      baseUrl: MWS_HOST + '/mws'
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

var MWShell = function (rootElement) {
  this.$rootElement = $(rootElement);
  this.$input = null;
  this.mwsResourceID = null;
};

MWShell.prototype.injectHTML = function () {
  // TODO: Use client-side templating instead.
  var html = '<div class="mws-body">' +
               '<ul class="mws-response-list">' +
                 '<li>' +
                   this.$rootElement.get(0).innerHTML +
                 '</li>' +
                 '<li class="input-li">' +
                   '>' +
                   '<form class="mws-form">' +
                     '<input type="text" class="mws-input" disabled="true">' +
                   '</form>' +
                 '</li>' +
               '</ul>' +
             '</div>';
  this.$rootElement.html(html);
  this.$input = this.$rootElement.find('.mws-input');
};

MWShell.prototype.attachInputHandler = function (mwsResourceID) {
  var shell = this;
  this.mwsResourceID = mwsResourceID;
  this.$rootElement.find('form').submit(function (e) {
    e.preventDefault();
    shell.handleInput();
    shell.$input.val('');
  });
};

MWShell.prototype.enableInput = function (bool) {
  this.$input.get(0).disabled = !bool;
};

MWShell.prototype.handleInput = function () {
  var data = this.$input.val();
  // Display input in shell output
  this.insertResponseLine(data);
  console.debug('Received text:', data, this.mwsResourceID);
  // TODO: Merge #25: Parse <input> content; Make AJAX request based on
  // parsed input. On success/error, return output to console, at class
  // mws-response-list.
};

MWShell.prototype.insertResponseArray = function (data) {
  for (var i = 0; i < data.length; i++) {
    this.insertResponseLine(data[i]);
  }
};

MWShell.prototype.insertResponseLine = function (data) {
  var li = document.createElement('li');
  li.innerHTML = data;
  this.$rootElement.find('.input-li').before(li);

  // scrolling
  var scrollArea = this.$rootElement.find('.mws-response-list').get(0);
  scrollArea.scrollTop = scrollArea.scrollHeight;
};

$(document).ready(mongo.init);
