'use strict';

! function () {

    var helper;

    module.exports = {
        init: init
    };

    function init(argv) {

        var fs = require('fs'),
            path = require('path'),
            src = path.join(path.dirname(fs.realpathSync(__filename)), '../src', path.sep),
            configGenerator = require('./issue-config.js').init(argv),
            config = configGenerator();

        helper = require('./issue-utils.js');

        helper.chalk = getChalk(config.technicolor);

        helper.src = src;
        helper.config = config;
        helper.configGenerator = configGenerator;

        helper.events = {
            closed: function() { /* evt.actor.login */
                return 'status: closed';
            },
            reopened: function() { /* evt.actor.login */
                return 'status: reopened';
            },
            merged: function() { /* evt.actor.login */
                return 'status: merged';
            },
            locked: function() { /* evt.actor.login */
                return 'locking: locked';
            },
            unlocked: function() { /* evt.actor.login */
                return 'locking: unlocked';
            },
            subscribed: function(user) {
                'subscribed: ' + user;
            },
            mentioned: function(user) {
                'mentioned: ' + user;
            },
            assigned: function(user) {
                'assigned: ' + user;
            },
            unassigned: function(user) {
                'unassigned: ' + user;
            },
            labeled: function(user) {
                'added label: ' + user;
            },
            unlabeled: function(user) {
                'removed label: ' + user;
            },
            milestoned: function(user) {
                'added milestone: ' + user;
            },
            demilestoned: function(user) {
                'removed milestone: ' + user;
            },
            renamed: function(user) {
                'renamed issue: ' + user;
            },
            branchDeleted: function() {
                return 'branch: deleted';
            },
            branchRestored: function() {
                return 'branch: restored';
            },
            referenced: function() {
                return 'The issue was referenced from a commit message';
            },
            pullRequest: function() {
                return 'pull request opened';
            },
            update: function() {
                return 'update to issue';
            }
        }

        var issuemd = require('issuemd');

        var colorisationFunctions = {
            bkey: function (val, render) {
                return render(helper.chalk.red(val));
            },
            bsep: function (val, render) {
                return render(helper.chalk.bold.gray(val));
            },
            htext: function (val, render) {
                return render(config && config.dim ? helper.chalk.bold.bgWhite.red(val) : helper.chalk.bold.bgRed(val));
            },
            hsep: function (val, render) {
                return render(config && config.dim ? helper.chalk.bold.bgWhite.white(val) : helper.chalk.bold.bgRed.red(val));
            },
            btext: function (val, render) {
                return render(helper.chalk.reset(val));
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

        helper.issuemd = issuemd;

        var plugins = require('./issue-plugins.js')(helper);
        helper.plugins = plugins;

        return {
            helper: helper,
            run: run
        };

        function getChalk(technicolor) {

            var localChalk = require('chalk');

            var mychalk = new localChalk.constructor({
                enabled: technicolor
            });

            mychalk.stripColor = localChalk.stripColor;

            return mychalk;

        }
    }

    function run(argv) {

        var fs = require('fs');

        var helper = init(argv).helper,
            config = helper.config,
            plugins = helper.plugins,
            src = helper.src,
            configGenerator = helper.configGenerator;

        var cliParams = config.params;

        // grab the main command, which should be a plugin name to handle sub-commands
        var command = cliParams[0];

        bannerHandler(config, helper, fs, src);

        if (command === 'config') {
            commandConfig(cliParams, configGenerator, helper, !!config.userhome);
        } else {
            // if there is no sub-command, show help
            // else if there is a plugin, pass the subCommand to the plugin to handle
            // else if the plugin is disabled, show disabled plugin message
            // else show unknown command message
            if (!cliParams.length) {

                var helptext;

                if (config.help) {

                    helptext = fs.readFileSync(src + 'issue-cli-help.txt', 'UTF-8');

                    var pluginhelp = [];
                    for (var name in plugins) {

                        var plugin = plugins[name];
                        if (plugin.helptext) {
                            pluginhelp.push(name.slice(0, 1).toUpperCase() + name.slice(1) + ' plugin:\n\n' + plugin.helptext);
                        }

                    }

                    if (pluginhelp.length) {
                        helptext += '\n' + pluginhelp.join('\n\n') + '\n';
                    }

                } else {
                    helptext = fs.readFileSync(src + 'issue-cli-usage.txt', 'UTF-8');
                }

                return helptext;

            } else if (!!plugins[command]) {
                cliParams.shift();
                config.command = cliParams.shift();
                return plugins[command](config, config.command);
            } else if (plugins[command] === false) {
                return 'The ' + command + ' plugin disabled. You can re-enable it with:\n\n\tissue config plugins.' + command + '.enabled true\n';
            } else {
                return 'Don\'t understand that command... sorry :-/';
            }
        }
    }

    function bannerHandler(config, helper, fs, src) {
        if (config.banner === 'always' || config.params[0] === undefined || config.params[0] === 'init') {
            var logo;
            if (config.banner !== false) {
                if (config.width >= 80) {
                    logo = fs.readFileSync(src + 'issue-cli-ascii-logo.txt').toString('UTF-8');
                } else {
                    logo = helper.chalk.red.bold('\n    #') + helper.chalk.white.bold('issue') + helper.chalk.grey(' cli - commanding your issues\n');
                }
                console.log(config.technicolor ? logo : helper.chalk.stripColor(logo));
            }
        }
    }

    /*
     * set config items in user's config file
     *     $ issue config myconfig.key mynewval
     *     $ issue config myconfig.key mynewval --userhome
     */
    function commandConfig(cliParams, configGenerator, helper, userConfigFlag) {

        // switch the number of sub-commands
        switch (cliParams.slice(1).length) {

            case 0:
                // list all config options
                console.log(userConfigFlag ? '** not yet implemented for userconfig **' : configGenerator.list());
                break;

            case 1:
                // list config option specified in first sub-command
                console.log(userConfigFlag ? '** not yet implemented for userconfig **' : configGenerator(cliParams[1]));
                break;

            case 2:
                // if first sub-command is `remove` then remove from config, key specified in second sub-command
                // else set key/value as first/second sub-command
                if (cliParams[1] === 'remove') {
                    helper.promptYesNo('Are you sure you want to write new config to disk? [Yn]', function () {
                        configGenerator(cliParams[2], null, userConfigFlag);
                    }, helper.chalk.red('aborted config change'), 'y');
                } else {
                    helper.promptYesNo('Are you sure you want to write new config to disk? [Yn]', function () {
                        configGenerator(cliParams[1], cliParams[2], userConfigFlag);
                    }, helper.chalk.red('aborted config change'), 'y');
                }
                break;
        }
    }

}();
