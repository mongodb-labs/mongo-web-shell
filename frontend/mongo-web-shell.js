var mongoWebShell = (function () {
  // TODO: Provide a way for the embeder to specify path. <meta> tag? js obj?
  var CSS_PATH, MWS_BASE_RES_URL, MWS_HOST;
  CSS_PATH = "mongo-web-shell.css";
  MWS_HOST = 'http://localhost:5000';
  MWS_BASE_RES_URL = MWS_HOST + '/mws';

  function injectStylesheet() {
    var linkElement = document.createElement('link');
    linkElement.href = CSS_PATH;
    linkElement.rel = 'stylesheet';
    linkElement.type = 'text/css';
    $('head').append(linkElement);
  }

  function injectShellHTML(element) {
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
    element.innerHTML = html;
  }

  function handleShellInput(e) {
    var formElement = e.target;
    e.preventDefault();
    console.log('Input event received.', e);
    // TODO: Merge #25: Parse <input> content; remove console.log. Make AJAX
    // request based on parsed input. On success/error, return output to
    // console, at class mws-in-shell-response.
  }

  return {
    /**
     * Injects a mongo web shell into the DOM wherever an element of class
     * 'mongo-web-shell' can be found. Additionally sets up the resources
     * required by the web shell, including the mws REST resource and the mws
     * CSS stylesheets.
     */
    injectShells: function () {
      injectStylesheet();
      $('.mongo-web-shell').each(function (index, element) {
        injectShellHTML(element);
        // TODO: Disable shell input by default (during creation).
        $.post(MWS_BASE_RES_URL, null, function (data, textStatus, jqXHR) {
          // TODO: Check textStatus.
          $(element).find('.mws-input').submit(handleShellInput);
          // TODO: Enable shell input after disabling above.
          // TODO: Inject returned mws resource id into appropriate elements;
          // maybe the form so it's easy to get from input handler?
        }, 'json').fail(function (jqXHR, textStatus, errorThrown) {
          // TODO: Display error message in the mongo web shell. Remove log.
          console.log('AJAX request failed:', textStatus, errorThrown);
        });
      });
    }
  };
}());

$(document).ready(mongoWebShell.injectShells);
