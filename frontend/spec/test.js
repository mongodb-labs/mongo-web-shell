$(document).ready(function () {  
  	/*
  	 * expect(A).toBeDefined();
	 * expect(A).not.toBeDefined();
	 * expect(B).toBeNull();
	 * expect(BBB).toContains(B);	
	 */
  describe("MONGO DOM", function() {   	
 	 it("test retrieveConfig", function() {	  
		var c = mongo.dom.retrieveConfig();  	
		expect(c.cssPath).toEqual('mongo-web-shell.css'); 
		expect(c.mwsHost).toEqual('http://localhost:5000'); 
		expect(c.baseUrl).toEqual('http://localhost:5000/mws'); 
   	 });

	 it("test injectStylesheet", function() {
		var c = mongo.dom.retrieveConfig();		
		var linkElement = document.getElementsByTagName('link')[0];
		var href = linkElement.getAttribute("href");
		expect(href).toNotEqual('mongo-web-shell.css');	
	
    	mongo.dom.injectStylesheet(c.cssPath);

		linkElement = document.getElementsByTagName('link')[0];

		expect(linkElement.getAttribute("href")).toEqual('mongo-web-shell.css'); 
		expect(linkElement.getAttribute("rel")).toEqual('stylesheet'); 
		expect(linkElement.getAttribute("type")).toEqual('text/css'); 
   	 });

  });  

  describe("MWSHELL", function() {  	
    it("injectHTML", function() {			
		expect($('.mws-border').length).toEqual(0);
		expect($('.mshell').length).toEqual(0);
		expect($('.mws-input').length).toEqual(0);

		var shell = new MWShell($('.mongo-web-shell'));  
		shell.injectHTML();

		expect($('.mws-border').length).toEqual(1);
		expect($('.mshell').length).toEqual(1);
		expect($('.mws-input').length).toEqual(1);
   	 });

  });  
});
