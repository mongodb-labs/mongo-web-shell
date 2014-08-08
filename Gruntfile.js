'use strict';

module.exports = function(grunt) {
    require('load-grunt-tasks')(grunt);
    require('time-grunt')(grunt);

    var dest = 'frontend/dist';

    var concatConfig = {
        name: 'concat',
        createConfig: function(context, block) {
            /* Modified version of https://github.com/yeoman/grunt-usemin/blob/master/lib/config/concat.js
                `file.nonull = true` fails during build if a provided file doesn't exist */
            var path = require('path');

            var cfg = {files: []};
            var outfile = path.join(context.outDir, block.dest);

            // Depending whether or not we're the last of the step we're not going to output the same thing
            var files = {};
            files.dest = outfile;
            files.src = [];
            files.nonull = true;
            context.inFiles.forEach(function(f) { files.src.push(path.join(context.inDir, f));} );
            cfg.files.push(files);
            context.outFiles = [block.dest];
            return cfg;
        }
    };

    grunt.initConfig({
        watch: {
            livereload: {
                options: {
                    livereload: 35730
                },
                files: [
                    'frontend/*.html',
                    'frontend/src/mws/**/*.js'
                ]
            }
        },
        copy: {
            templates: {
                expand: true,
                cwd: 'frontend/',
                src: '*.html',
                dest: dest
            }
        },
        clean: {
            dist: [dest + '/*', '!' + dest + '/.git*', '.tmp/*']
        },
        useminPrepare: {
            html: [
                'frontend/*.html'
            ],
            options: {
                flow: {
                    steps: {
                        js: [concatConfig, 'uglifyjs'],
                        css: ['cssmin']
                    },
                    post: {}
                },
                dest: dest,
                root: './frontend'
            }
        },
        usemin: {
            html: dest + '/*.html',
            options: {
                // List of directories to look for revved versions of assets
                assetsDirs: [dest]
            }
        },
        filerev: {
            options: {
                length: 10
            },
            files: {
                src: ['frontend/dist/**/*.{js,css}']
            }
        }
    });


    grunt.registerTask('build', [
        'clean:dist',
        'useminPrepare',
        'copy:templates',
        'concat',
        'uglify',
        'cssmin',
        'filerev',
        'usemin'
    ]);

};
