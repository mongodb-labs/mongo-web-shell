window.addEventListener('load', function() {
    var queryForm = document.getElementById('queryForm');
    queryForm.addEventListener('submit', sendMessage, false);
}, false);

/*
 * input: form to get query user enter
 * output: send the query to the server 
 */
function sendMessage(e) {   
    e.preventDefault();
    var fd = new FormData(document.getElementById('queryForm'));   
    var li = document.createElement('li');
    var req = new XMLHttpRequest();
    var ul = document.getElementById('response');
	
	  li.innerHTML = document.getElementById('query').value;			
	  ul.appendChild(li);

    req.addEventListener('load', getResponse, false);
    req.open('POST', '/db', true);
    req.send(fd);
}

function getResponse(e) {
  	var request = e.target;

  	if (request.status == 200) {  
        var content = request.responseText;		
        var data = JSON.parse(content); 
        var ul = document.getElementById('response');
  
   	  	for (var i = 0; i < data1.length; i++) {
    	  		var li = document.createElement('li');
    	  		li.innerHTML = objToString(data[i]);			
    	  		ul.appendChild(li);			
  	  	}

    } else {
        console.log("request is not ready");	
    }
}

function objToString(obj) {
    var str = '{';
 
    for (var p in obj) {
        if (obj.hasOwnProperty(p)) {
        str += p + ':' + obj[p] + ',';
        }
    }
  
    str +='}';
    return str;
}
