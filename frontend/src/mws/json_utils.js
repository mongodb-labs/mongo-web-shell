/* global mongo */
mongo.types = (function () {
  var tojson = function(x, indent, nolint){
    if (x === null) {
      return 'null';
    }

    if (x === undefined) {
      return 'undefined';
    }

    if (!indent) {
      indent = '';
    }

    switch (typeof x) {
    case 'string':
      var out = new Array(x.length+1);
      out[0] = '"';
      for (var i=0; i<x.length; i++){
        switch (x[i]) {
        case '"':
          out[out.length] = '\\"';
          break;
        case '\\':
          out[out.length] = '\\\\';
          break;
        case '\b':
          out[out.length] = '\\b';
          break;
        case '\f':
          out[out.length] = '\\f';
          break;
        case '\n':
          out[out.length] = '\\n';
          break;
        case '\r':
          out[out.length] = '\\r';
          break;
        case '\t':
          out[out.length] = '\\t';
          break;

        default:
          var code = x.charCodeAt(i);
          if (code < 0x20){
            out[out.length] = (code < 0x10 ? '\\u000' : '\\u00') + code.toString(16);
          } else {
            out[out.length] = x[i];
          }
        }
      }

      return out.join('') + '"';
    case 'number':
        /* falls through */
    case 'boolean':
      return '' + x;
    case 'object':
      var s = tojsonObject(x, indent, nolint);
      if ((nolint === null || nolint === true) &&
          s.length < 80 && (indent === null ||
          indent.length === 0)){
        s = s.replace(/[\t\r\n]+/gm, ' ');
      }
      return s;
    case 'function':
      return x.toString();
    default:
      throw 'tojson can\'t handle type ' + (typeof x);
    }
  };

  var tojsonObject = function(x, indent, nolint){
    var lineEnding = nolint ? ' ' : '\n';
    var tabSpace = nolint ? '' : '\t';

    if (!indent) {
      indent = '';
    }

    if (typeof(x.tojson) === 'function' && x.tojson !== tojson) {
      return x.tojson(indent, nolint);
    }

    if (x.constructor &&
        typeof(x.constructor.tojson) === 'function' &&
        x.constructor.tojson !== tojson) {
      return x.constructor.tojson(x, indent, nolint);
    }

    if (x instanceof Error) {
      return x.toString();
    }

    var s = '{' + lineEnding;

    // push one level of indent
    indent += tabSpace;

    var total = 0;
    for (var k in x) {
      if (x.hasOwnProperty(k)) {
        total++;
      }
    }
    if (total === 0) {
      s += indent + lineEnding;
    }

    var keys = x;
    if (typeof(x._simpleKeys) === 'function') {
      keys = x._simpleKeys();
    }
    var num = 1;
    for (k in keys) {
      if (keys.hasOwnProperty(k)) {
        var val = x[k];

        s += indent + '"' + k + '" : ' + tojson(val, indent, nolint);
        if (num !== total) {
          s += ',';
          num++;
        }
        s += lineEnding;
      }
    }

    // pop one level of indent
    indent = indent.substring(1);
    return s + indent + '}';
  };

  // Type specific functions to convert to JSON
  var dateToJson = function () {
    var UTC = 'UTC';
    var year = this['get' + UTC + 'FullYear']().zeroPad(4);
    var month = (this['get' + UTC + 'Month']() + 1).zeroPad(2);
    var date = this['get' + UTC + 'Date']().zeroPad(2);
    var hour = this['get' + UTC + 'Hours']().zeroPad(2);
    var minute = this['get' + UTC + 'Minutes']().zeroPad(2);
    var sec = this['get' + UTC + 'Seconds']().zeroPad(2);

    if (this['get' + UTC + 'Milliseconds']()) {
      sec += '.' + this['get' + UTC + 'Milliseconds']().zeroPad(3);
    }

    var ofs = 'Z';
    return 'ISODate("'+year+'-'+month+'-'+date+'T'+hour+':'+minute+':'+sec+ofs+'")';
  };

  var arrayToJson = function (a, indent, nolint) {
    var lineEnding = nolint ? ' ' : '\n';

    if (!indent) {
      indent = '';
    }
    if (nolint) {
      indent = '';
    }

    if (a.length === 0) {
      return '[ ]';
    }

    var s = '[' + lineEnding;
    indent += '\t';
    for (var i = 0; i < a.length; i++) {
      s += indent + mongo.util.tojson(a[i], indent, nolint);
      if (i < a.length - 1) {
        s += ',' + lineEnding;
      }
    }
    if (a.length === 0) {
      s += indent;
    }

    indent = indent.substring(1);
    s += lineEnding + indent + ']';
    return s;
  };

  var numberZeroPad = function (width) {
    return ('' + this).pad(width, false, '0');
  };

  var setToJsonFunctions = function (context) {
    context.Date.prototype.tojson = dateToJson;
    context.Array.tojson = arrayToJson;
    context.Number.prototype.zeroPad = numberZeroPad;
    context.tojson = tojson;
  };

  return {
    setToJsonFunctions: setToJsonFunctions
  };
}());