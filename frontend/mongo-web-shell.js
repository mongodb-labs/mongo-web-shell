var KEYCODE = 13;

var mongoWebShell = (function () {
  // TODO: Provide a way for the embeder to specify the path.
  var CSS_PATH = "mongo-web-shell.css";

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
    // TODO: mws-in-shell-response and mws-input set an ID received from the
    // server in the old version; where can we inject that?
    var html = '<div class="mws-border">' +
                 '<div class="mshell">' +
                   '<ul class="mws-in-shell-response"></ul>' +
                   '<input type="text" class="mws-input">' +
                 '</div>' +
               '</div>';
    element.innerHTML = html;
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
        // TODO: POST mws resource. On success, add shell input handler, enable
        // shell input. On error, display error message in the shell.
        // $.post("db", null, createMongoShell(div), "text");
      });
    }
  };
}());

function addInputSubmitEvent(input) {
  input.onkeydown = function(e) {
    if (e.keyCode == KEYCODE) {
      submitInputAjax(input);
    }
  };
}

function submitInputAjax(input){
  var url = "db/:" + input.id + "/find/"
  var indata = parseInput(input.value);
  $.post(url, indata, submitHelper(input), "text");
  input.value = "$";
}

function submitHelper(input){
  return function(data, status){
    if (status == 200){
      var outputs = document.getElementsByClassName("inshellresponse");
      for (var output in outputs){
        if (outputs[output].id.valueOf() == input.id.valueOf()) {
          var responseLines = data.split("\n");
            for (var line in responseLines){
              if (line == responseLines.length - 1){
                break;
              }
              var newLI = document.createElement("li");
              newLI.innerHTML = responseLines[line];
              outputs[output].innerHTML.appendChild(newLI);
            }
        }
      }
    }
  };
}

$(document).ready(mongoWebShell.injectShells);
