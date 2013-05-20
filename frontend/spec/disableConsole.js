var ATTR = [
  'debug',
  'error',
  'info',
  'log',
  'warn'
];
var console = {};
ATTR.forEach(function (attr) {
  console[attr] = function () {};
});
