/* jshint node: true */

var FRONTEND_DIR = 'frontend/';
var SRC_DIR = FRONTEND_DIR + 'src/';
var DIST_DIR = FRONTEND_DIR + 'dist/';

module.exports = function (grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      dist: {
        src: [
          SRC_DIR + 'head.js',
          SRC_DIR + 'mws/**/*.js',
          SRC_DIR + 'tail.js'
        ],
        dest: DIST_DIR + 'mongoWebShell.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');

  grunt.registerTask('default', ['concat']);
};
