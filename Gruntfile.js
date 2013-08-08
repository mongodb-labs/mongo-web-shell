/*    Copyright 2013 10gen Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/* jshint node: true, camelcase: false */
var FRONTEND_DIR = 'frontend/';
var LIB_DIR = FRONTEND_DIR + 'lib/';
var SPEC_DIR = FRONTEND_DIR + 'spec/';
var SRC_DIR = FRONTEND_DIR + 'src/';
var DIST_DIR = FRONTEND_DIR + 'dist/';

var JS_LIB = [
  LIB_DIR + 'es5-shim/es5-shim.min.js',
  LIB_DIR + 'esprima/esprima.js',
  LIB_DIR + 'falafel/falafel.browser.js',
  LIB_DIR + 'noty/js/noty/jquery.noty.js',
  LIB_DIR + 'noty/js/noty/layouts/top.js',
  LIB_DIR + 'noty/js/noty/layouts/topCenter.js',
  LIB_DIR + 'noty/js/noty/themes/default.js'
];

var JS_MWS = [
  SRC_DIR + 'head.js',
  SRC_DIR + 'mws/**/*.js',
  SRC_DIR + 'tail.js'
];

module.exports = function (grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    clean: {
      dist: {src: [DIST_DIR]}
    },

    concat: {
      js: {
        src: JS_LIB.concat(JS_MWS),
        dest: DIST_DIR + 'mongoWebShell.js'
      },
      minjs: {
        src: [
          DIST_DIR + '_lib.min.js',
          DIST_DIR + '_mws.min.js'
        ],
        dest: DIST_DIR + 'mongoWebShell.min.js'
      }
    },

    jasmine: {
      js: {
        src: DIST_DIR + 'mongoWebShell.js',
        options: {
          specs: SPEC_DIR + '**/*.spec.js',
          helpers: [
            SPEC_DIR + 'disableConsole.js',
            SPEC_DIR + 'globals.js'
          ],
          vendor: [
            LIB_DIR + 'sinon/sinon.js',
            'https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js'
          ]
        }
      },
      minified: {
        src: DIST_DIR + 'mongoWebShell.min.js',
        options: {
          specs: SPEC_DIR + '**/*.spec.js',
          helpers: [
            SPEC_DIR + 'disableConsole.js',
            SPEC_DIR + 'globals.js'
          ],
          vendor: [
            LIB_DIR + 'sinon/sinon.js',
            'https://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js'
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
      mws: {
        files: [SRC_DIR + '**/*'],
        tasks: ['closure-compiler:mws', 'concat']
      },
      lib: {
        files: [LIB_DIR + '**/*'],
        tasks: ['closure-compiler:lib', 'concat']
      },
      css: {
        files: [FRONTEND_DIR + '*.css'],
        tasks: ['cssmin']
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
    },

    'closure-compiler': {
      mws: {
        js: JS_MWS,
        jsOutputFile: DIST_DIR + '_mws.min.js',
        maxBuffer: 500,
        options: {
          compilation_level: 'SIMPLE_OPTIMIZATIONS',
          language_in: 'ECMASCRIPT5'
        },
        noreport: true
      },

      lib: {
        js: JS_LIB,
        jsOutputFile: DIST_DIR + '_lib.min.js',
        maxBuffer: 500,
        options: {
          compilation_level: 'SIMPLE_OPTIMIZATIONS',
          language_in: 'ECMASCRIPT5'
        },
        noreport: true
      }
    },

    cssmin: {
      minify: {
        expand: true,
        cwd: DIST_DIR,
        src: ['*.css', '!*.min.css'],
        dest: DIST_DIR,
        ext: '.min.css'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jasmine');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-closure-compiler');
  grunt.loadNpmTasks('grunt-contrib-cssmin');

  grunt.registerTask('minify', ['closure-compiler', 'cssmin']);
  grunt.registerTask('default', ['minify', 'concat']);
  grunt.registerTask('pep8', ['shell:pep8']);
  grunt.registerTask('unittest', ['shell:unittest']);
  grunt.registerTask(
    'test',
    ['jshint', 'minify', 'concat', 'jasmine', 'pep8', 'unittest']
  );
};
