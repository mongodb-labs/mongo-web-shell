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
    var $shell = $(shellElement);
    mongo.dom.injectShellHTML($shell);

    // Create MWS resource on remote server.
    $.post(config.baseUrl, null, function (data, textStatus, jqXHR) {
      if (!data.res_id) {
        // TODO: Print error in shell. Improve error below.
        console.warn('No res_id received! Shell disabled.', data);
        //return;
      }
      console.info('/mws/' + data.res_id, 'was created succssfully.');
      mongo.dom.attachShellInputHandler($shell, data.res_id);
      $shell.find('.mws-input').get(0).disabled = false;
    },'json').fail(function (jqXHR, textStatus, errorThrown) {
      // TODO: Display error message in the mongo web shell.
      console.error('AJAX request failed:', textStatus, errorThrown);
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

  return {
    retrieveConfig: function () {
      var $curScript = $('script').last();
      return {
        cssPath: $curScript.data('css-path') || CSS_PATH,
        mwsHost: $curScript.data('mws-host') || MWS_HOST,
        baseUrl: MWS_HOST + '/mws'
      };
    },

    injectStylesheet: function (cssPath) {
      var linkElement = document.createElement('link');
      linkElement.href = cssPath;
      linkElement.rel = 'stylesheet';
      linkElement.type = 'text/css';
      $('head').prepend(linkElement); // Prepend so css can be overridden.
    },

    injectShellHTML: function ($element) {
      // TODO: Use client-side templating instead.
      // TODO: Why is there a border class? Can it be done with CSS border (or
      // be renamed to be more descriptive)?
      // TODO: .mshell not defined in CSS; change it.
      var html = '<div class="mws-border">' +
                   '<div class="mshell">' +
                     '<ul class="mws-in-shell-response"></ul>' +
                     '<form>' +
                       '<input type="text" class="mws-input" ' +
                           'disabled="true">' +
                     '</form>' +
                   '</div>' +
                 '</div>';
      $element.html(html);
    },

    attachShellInputHandler: function ($shell, mwsResourceID) {
      $shell.find('form').submit(function (e) {
        e.preventDefault();
        var $input = $(e.target).find('.mws-input');
        mongo.input.handleShellInput($input.val(), mwsResourceID);
        $input.val('');
      });
    }
  };
}());

mongo.input = (function () {
  return {
    handleShellInput: function (data, mwsResourceID) {
      console.debug('Received text:', data, mwsResourceID);
      // TODO: Merge #25: Parse <input> content; Make AJAX request based on
      // parsed input. On success/error, return output to console, at class
      // mws-in-shell-response.
    }
  };
}());

$(document).ready(mongo.init);
