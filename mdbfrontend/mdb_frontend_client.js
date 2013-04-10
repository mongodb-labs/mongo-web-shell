function insertShells(){
    //create shells and dbs
    $(".mongoshell").each(function(){
        var div = this;
        $.post("db", null, createMongoShell(div), "text");
    })

    //add input listening
    var inputs = document.getElementsByClassName("sinput");
    for (var i = 0; i < inputs.length; i++){
        addInputSubmitEvent(inputs[i]);
		inputs[i].value = "$";
    }

    //add the css
    var element = document.createElement('link');
    element.href = 'shellCss.css';
    element.rel = 'stylesheet';
    element.type = 'text/css';
    document.body.appendChild(element);
}

function createMongoShell(div){
    return function(data, status){
        if (status == 200){
            var text =  '<div id = "mshellborder"><div id = "mshell"> <ul class = "inshellresponse" id ="' + data + '"> </ul><input type = "text" id ="' + data + '"class = "sinput"></div>';
            div.innerHTML = text;
        }
    }
}

function addInputSubmitEvent(input) {
    input.onkeydown = function(e) {
        e = e || window.event;
        if (e.keyCode == 13) {
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

function insertShellsMock(){
    //create shells and dbs
	var i = 0;
    $(".mongoshell").each(function(){
		i++;
        createMongoShellMock(this, i);
    })

    //add input listening
    var inputs = document.getElementsByClassName("sinput");
    for (var i = 0; i < inputs.length; i++){
        addInputSubmitEventMock(inputs[i]);
		inputs[i].value = "$";
    }

    //add the css
    var element = document.createElement('link');
    element.href = 'shellCss.css';
    element.rel = 'stylesheet';
    element.type = 'text/css';
    document.body.appendChild(element);
}

function createMongoShellMock(div, i){
    var text =  '<div id = "mshellborder"><div id = "mshellresponse"><ul class = "inshellresponse" id ="' + 'test' + i + '" > </ul></div><div id="sinput"><input type = "text" id ="' + 'test' + i + '" class = "sinput"></div></div>';
    div.innerHTML = text;
}

function addInputSubmitEventMock(input) {
    input.onkeydown = function(e) {
        e = e || window.event;
        if (e.keyCode == 13) {
            submitInputAjaxMock(input);
        }
    };
}

function submitInputAjaxMock(input){
	var data = "Hi \n This is a query response \n Yaaaay\n";
    var outputs = document.getElementsByClassName("inshellresponse");
    for (var i = 0; i < outputs.length; i++){
        if (outputs[i].id.valueOf() == input.id.valueOf()) {
            var responseLines = data.split("\n");
            for (var line in responseLines){
				if (line == responseLines.length - 1){
					break;
				}
                var newLI = document.createElement("li");
                newLI.innerHTML = responseLines[line];
                outputs[i].appendChild(newLI);
            }
        }
    }
	input.value = "$";
}


function parseInput(value){
    /**
     * Stub parsing method
     */
	value = value.substr(1, value.length); //remove $ symbol
    return value;
}
