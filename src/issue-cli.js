'use strict';

! function () {

    module.exports = {
        run: run
    };

    function run(argv) {

        var fs = require('fs'),
            path = require('path'),
            _ = require('underscore'),
            issuemd = require('issuemd'),
            src = path.join(path.dirname(fs.realpathSync(__filename)), '../src'),
            issueConfig = require(src + '/issue-config.js').init(argv),
            config = issueConfig(),
            helper = require(src + '/issue-helper.js')(config.technicolor),
            cliParams = issueConfig().params,
            issueTemplates = require(src + '/issue-templates.js'),
            pluginDir = '../plugins/';

        var plugins = {
            init: require(src + '/issue-init.js')(issueConfig)
        };

        // enable all plugins by default
        _.each(fs.readdirSync(__dirname + '/' + pluginDir), function (value) {
            config.plugins = config.plugins || {};
            if (fs.lstatSync(__dirname + '/' + pluginDir + value).isDirectory()) {
                config.plugins[value] = config.plugins[value] || {};
                if (typeof config.plugins[value].enabled === 'undefined') {
                    config.plugins[value].enabled = true;
                }
            }
        });

        _.each(config.plugins, function (value, name) {
            if (!!value.enabled) {
                plugins[name] = require(pluginDir + name + '/main.js')(issueConfig, helper, issuemd, issueTemplates);
            } else {
                plugins[name] = false;
            }
        });

        if (config.banner === 'always' || _.isUndefined(config.params[0]) || config.params[0] === 'init') {
            var logo;
            if (config.banner !== false) {
                if (config.width >= 80) {
                    logo = fs.readFileSync(src + '/issue-cli-ascii-logo.txt').toString('UTF-8');
                } else {
                    logo = helper.chalk.red.bold('\n    #') + helper.chalk.white.bold('issue') + helper.chalk.grey(' cli - commanding your issues\n');
                }
                console.log(config.technicolor ? logo : helper.chalk.stripColor(logo));
            }
        }

        // grab the main command, which should be a plugin name to handle sub-commands
        var command = cliParams[0];

        /*
         * set config items in user's config file
         *     $ issue userconfig myconfig.key mynewval
         */
        if (command === 'userconfig') {
            // switch the number of sub-commands
            switch (cliParams.slice(1).length) {

                case 0:
                    // list all config options in home directory's .issuerc file
                    console.log('** not yet implemented for userconfig **');
                    break;

                case 1:
                    // list config option specified in first sub-command in home directory's .issuerc file
                    console.log('** not yet implemented for userconfig **');
                    break;

                case 2:
                    // if first sub-command is `remove` then remove from config, key specified in second sub-command
                    // else set key/value as first/second sub-command
                    if (cliParams[1] === 'remove') {
                        helper.promptYesNo('Are you sure you want to write new config to disk? [Yn]', function () {
                            issueConfig(cliParams[2], null, true);
                        }, helper.chalk.red('aborted config change'), 'y');
                    } else {
                        helper.promptYesNo('Are you sure you want to write new config to disk? [Yn]', function () {
                            issueConfig(cliParams[1], cliParams[2], true);
                        }, helper.chalk.red('aborted config change'), 'y');
                    }
                    break;
            }
        } else {
            if (command === 'config') {
                // switch the number of sub-commands
                switch (cliParams.slice(1).length) {

                    case 0:
                        // list all config options
                        console.log(issueConfig.list());
                        break;

                    case 1:
                        // list config option specified in first sub-command
                        console.log(issueConfig(cliParams[1]));
                        break;

                    case 2:
                        // if first sub-command is `remove` then remove from config, key specified in second sub-command
                        // else set key/value as first/second sub-command
                        if (cliParams[1] === 'remove') {
                            helper.promptYesNo('Are you sure you want to write new config to disk? [Yn]', function () {
                                issueConfig(cliParams[2], null);
                            }, helper.chalk.red('aborted config change'), 'y');
                        } else {
                            helper.promptYesNo('Are you sure you want to write new config to disk? [Yn]', function () {
                                issueConfig(cliParams[1], cliParams[2]);
                            }, helper.chalk.red('aborted config change'), 'y');
                        }
                        break;
                }
            } else {
                // if there is no sub-command, show help
                // else if there is a plugin, pass the subCommand to the plugin to handle
                // else if the plugin is disabled, show disabled plugin message
                // else if the plugin is unconfigured, show unconfigured plugin message
                // else show unknown command message
                if (!cliParams.length) {
                    var helptext = fs.readFileSync(src + (config.help ? '/issue-cli-help.txt' : '/issue-cli-usage.txt')).toString('UTF-8');
                    console.log(helptext);
                } else if (!!plugins[command]) {
                    cliParams.shift();
                    var subCommand = cliParams.shift();
                    return plugins[command](config, subCommand);
                } else if (plugins[command] === false) {
                    console.log('The ' + command + ' plugin disabled. You can re-enable it with:\n\n\tissue config plugins.' + command + '.enabled true\n');
                } else if (helper.fileExists(__dirname + '/' + pluginDir + command + '/main.js')) {
                    console.log('The ' + command + ' plugin is not configured. You can enable it with:\n\n\tissue config plugins.' + command + '.enabled true\n');
                } else {
                    console.log('Don\'t understand that command... sorry :-/');
                }
            }
        }
    }

}();