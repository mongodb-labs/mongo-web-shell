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
          LIB_DIR + 'esprima/esprima.js',
          LIB_DIR + 'falafel/falafel.browser.js',
          LIB_DIR + 'noty/js/noty/jquery.noty.js',
          LIB_DIR + 'noty/js/noty/layouts/top.js',
          LIB_DIR + 'noty/js/noty/layouts/topCenter.js',
          LIB_DIR + 'noty/js/noty/themes/default.js',
          LIB_DIR + 'blockui/jquery.blockUI.js',
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
            SPEC_DIR + 'globals.js',
            SPEC_DIR + 'phantomJSWorkarounds.js'
          ],
          vendor: [
            LIB_DIR + 'sinon/sinon.js',
            'https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js',
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
    },

    shell: {
      pep8: {
        command: 'pep8 mongows tests run*.py',
        options: {
          stdout: true,
          stderr: true,
          failOnError: true
        }
      },
      unittest: {
        command: 'python run_tests.py',
        options: {
          failOnError: true
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('default', ['concat']);
  grunt.registerTask('pep8', ['shell:pep8']);
  grunt.registerTask('unittest', ['shell:unittest']);
  grunt.registerTask(
    'test',
    ['jshint', 'concat', 'jasmine', 'pep8', 'unittest']
  );
};
