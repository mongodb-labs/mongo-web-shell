$(document).ready(function() {	
	$('#console').bind('submit', sendCommand);
});

function sendCommand(e) {
	e.preventDefault();
	
	var command = $('#command').val();
	var parsedCommand = parseCommand(command);

	var url = '/' + parsedCommand.query;
	
	$.ajax({
		type: "POST",
		url: url,
		data: parsedCommand,
		success: onMongoSuccess,
		dataType: "json"
	});
}

function onMongoSuccess(result){
	$('#output').text(JSON.stringify(result));
}
 
function parseCommand(command) {
	var y = esprima.parse(command);

	var body = y.body[0];
	var expression = body.expression;

	switch (expression.type) {
		// We will have to support other types of expressions as well if we
		// need to support javascript statements.
		case 'CallExpression':
			// This is just supporting the basic versions of parsing arguments
			var arguments = "";
			
			if (expression.arguments.length > 0) {
				var properties = expression.arguments[0].properties;
				
				for (var itr = 0; itr < properties.length; itr++) {
					var property = properties[itr];
					
					if (property.key.type == "Literal") {
						arguments += property.key.value + ':' + 
									 property.value.raw + ','
					}
					else if (property.key.type == "Identifier") {
						arguments += property.key.name + ':' + 
									 property.value.raw + ',';
					}
				}
				
				arguments = arguments.substr(0, arguments.length - 1);
			}
		
			var callee = expression.callee;
			// Get the function which is being called
			var funName = callee.property.name;
			switch (funName) {
				case 'find':
					var db = callee.object.object.name;
					var collection = callee.object.property.name;
					
					var obj = new Object();
					
					obj.query = "find";
					obj.db = db;
					obj.collection = collection;
					obj.arguments = arguments;
					
					return obj;
				case 'save':
					var db = callee.object.object.name;
					var collection = callee.object.property.name;
					
					var obj = new Object();
					
					obj.query = "save";
					obj.db = db;
					obj.collection = collection;
					obj.arguments = arguments;
					
					return obj;
			}
			
			break;
		default:
	}
}
