var mongoWebShell = (function () {
  var CSS_PATH, MWS_BASE_RES_URL, MWS_HOST;
  // Default values.
  CSS_PATH = 'mongo-web-shell.css';
  MWS_HOST = 'http://localhost:5000';
  MWS_BASE_RES_URL = MWS_HOST + '/mws';

  function updateExternalResourcePaths($shell) {
    // TODO: Document these data attributes.
    // TODO: Should each shell be able to have its own host?
    CSS_PATH = $shell.data('css-path') || CSS_PATH;
    MWS_HOST = $shell.data('mws-host') || MWS_HOST;
    MWS_BASE_RES_URL = MWS_HOST + '/mws';
  }

  function injectStylesheet() {
    var linkElement = document.createElement('link');
    linkElement.href = CSS_PATH;
    linkElement.rel = 'stylesheet';
    linkElement.type = 'text/css';
    // TODO: Prepend? This would make the stylesheet overridable.
    $('head').append(linkElement);
  }

  function injectShellHTML($element) {
    // TODO: Use client-side templating instead.
    // TODO: Why is there a border class? Can it be done with CSS border (or be
    // renamed to be more descriptive)?
    // TODO: .mshell not defined in CSS; change it.
    var html = '<div class="mws-border">' +
                 '<div class="mshell">' +
                   '<ul class="mws-in-shell-response"></ul>' +
                   '<form>' +
                     '<input type="text" class="mws-input">' +
                   '</form>' +
                 '</div>' +
               '</div>';
    $element.html(html);
  }

  function handleShellInput(data, mwsResourceID) {
    console.log('Received text:', data, mwsResourceID);
    // TODO: Merge #25: Parse <input> content; remove console.log. Make AJAX
    // request based on parsed input. On success/error, return output to
    // console, at class mws-in-shell-response.
  }

  function attachShellInputHandler($shell, mwsResourceID) {
    $shell.find('form').submit(function (e) {
      var $input;
      e.preventDefault();
      $input = $(e.target).find('.mws-input');
      handleShellInput($input.val(), mwsResourceID);
      $input.val('');
    });
  }

  return {
    /**
     * Injects a mongo web shell into the DOM wherever an element of class
     * 'mongo-web-shell' can be found. Additionally sets up the resources
     * required by the web shell, including the mws REST resource and the mws
     * CSS stylesheets.
     */
    injectShells: function () {
      $('.mongo-web-shell').each(function (index, shellElement) {
        var $shell = $(shellElement);
        updateExternalResourcePaths($shell);
        injectShellHTML($shell);
        // TODO: Disable shell input by default (during creation).
        $.post(MWS_BASE_RES_URL, null, function (data, textStatus, jqXHR) {
          if (!data.res_id) {
            // TODO: Print error in shell. Improve error below.
            console.log('No res_id received!', data);
            return;
          }
          attachShellInputHandler($shell, data.res_id);
          // TODO: Enable shell input after disabling above.
        }, 'json').fail(function (jqXHR, textStatus, errorThrown) {
          // TODO: Display error message in the mongo web shell. Remove log.
          console.log('AJAX request failed:', textStatus, errorThrown);
        });
      });
      injectStylesheet();
    }
  };
}());

$(document).ready(mongoWebShell.injectShells);
