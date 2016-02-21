'use strict';

! function () {

    module.exports = function (issueConfig, helper) {

        var path = require('path'),
            fs = require('fs');

        var _ = require('underscore'),
            issuemd = require('issuemd');

        var chalk = helper.chalk;

        var config = issueConfig(),
            pluginDirs = [
                path.join(__dirname, '..', 'plugins'),
                path.join(__dirname, '..', '..')
            ].concat(config['plugin-dir'] ? [config['plugin-dir']] : []).map(function (pluginDir) {
                return path.resolve(pluginDir) + path.sep;
            });

        var colorisationFunctions = {
            bkey: function (val, render) {
                return render(chalk.red(val));
            },
            bsep: function (val, render) {
                return render(chalk.bold.gray(val));
            },
            htext: function (val, render) {
                return render(config && config.dim ? chalk.bold.bgWhite.red(val) : chalk.bold.bgRed(val));
            },
            hsep: function (val, render) {
                return render(config && config.dim ? chalk.bold.bgWhite.white(val) : chalk.bold.bgRed.red(val));
            },
            btext: function (val, render) {
                return render(chalk.reset(val));
            }
        };

        // TODO: tidier way to define custom colours, perhaps introduce config method in issuemd, or plugin?
        var summaryCache = issuemd.fn.summary;
        issuemd.fn.summary = function () {
            var args = [].slice.call(arguments, 0);
            args[2] = args[2] || colorisationFunctions;
            return summaryCache.apply(this, args);
        };

        var stringCache = issuemd.fn.toString;
        issuemd.fn.toString = function () {
            var args = [].slice.call(arguments, 0);
            args[2] = args[2] || colorisationFunctions;
            return stringCache.apply(this, args);
        };

        var plugins = {
            init: require('./issue-init.js')(issueConfig, helper)
        };

        _.each(pluginDirs, function (pluginDir) {

            if (helper.fileExists(pluginDir) && fs.lstatSync(pluginDir).isDirectory()) {

                // enable all plugins by default
                _.each(fs.readdirSync(pluginDir), function (projectName) {

                    var value,
                        packageJson;

                    if (/^issue-plugin-.+/.test(projectName)) {

                        value = projectName.match(/^issue-plugin-(.+)/)[1];
                        config.plugins = config.plugins || {};

                        if (fs.lstatSync(pluginDir + projectName).isDirectory()) {

                            config.plugins[value] = config.plugins[value] || {};

                            if (typeof config.plugins[value].enabled === 'undefined') {
                                config.plugins[value].enabled = true;
                            }

                            if (!!config.plugins[value].enabled) {
                                packageJson = require(pluginDir + projectName + path.sep + 'package.json');
                                plugins[value] = require(pluginDir + projectName + path.sep + packageJson.main)(issueConfig, helper, issuemd);
                            } else {
                                plugins[value] = false;
                            }

                        }
                    }
                });

            }

        });

        return plugins;

    };

}.call(null);
