/* jshint node: true */
var FRONTEND_DIR = 'frontend/';
var LIB_DIR = FRONTEND_DIR + 'lib/';
var SPEC_DIR = FRONTEND_DIR + 'spec/';
var SRC_DIR = FRONTEND_DIR + 'src/';
var DIST_DIR = FRONTEND_DIR + 'dist/';

module.exports = function (grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    clean: {
      dist: {src: [DIST_DIR]}
    },

    concat: {
      dist: {
        src: [
          SRC_DIR + 'head.js',
          SRC_DIR + 'mws/**/*.js',
          SRC_DIR + 'tail.js'
        ],
        dest: DIST_DIR + 'mongoWebShell.js'
      }
    },

    jasmine: {
      dist: {
        src: DIST_DIR + '**/*.js',
        options: {
          specs: SPEC_DIR + '**/*.spec.js',
          helpers: [
            SPEC_DIR + 'disableConsole.js',
            SPEC_DIR + 'globals.js'
          ],
          vendor: [
            'http://sinonjs.org/releases/sinon-1.6.0.js',
            'https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js',
            LIB_DIR + 'falafel/falafel.browser.js'
          ]
        }
      }
    },

    jshint: {
      gruntfile: {src: ['Gruntfile.js']},
      spec: {src: [SPEC_DIR + '**/*.js']},
      src: {src: [SRC_DIR + '**/*.js']},
      options: {
        jshintrc: FRONTEND_DIR + '.jshintrc'
      }
    },

    watch: {
      dist: {
        files: [SRC_DIR + '**/*'],
        tasks: ['default']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['concat']);
  grunt.registerTask('test', ['concat', 'jasmine']);
};
