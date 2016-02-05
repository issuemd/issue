'use strict';

! function () {

    module.exports = {
        run: run
    };

    function run(argv) {

        var fs = require('fs'),
            path = require('path'),
            src = path.join(path.dirname(fs.realpathSync(__filename)), '../src', path.sep),
            issueConfig = require('./issue-config.js').init(argv),
            config = issueConfig(),
            helper = require('./issue-helper.js')(config.technicolor),
            plugins = require('./issue-plugins.js')(issueConfig, helper),
            cliParams = issueConfig().params;

        bannerHandler(config, helper, fs, src);

        // grab the main command, which should be a plugin name to handle sub-commands
        var command = cliParams[0];

        if (command === 'config') {
            commandConfig(cliParams, issueConfig, helper, !!config.userhome);
        } else {
            // if there is no sub-command, show help
            // else if there is a plugin, pass the subCommand to the plugin to handle
            // else if the plugin is disabled, show disabled plugin message
            // else show unknown command message
            if (!cliParams.length) {
                var helptext = fs.readFileSync(src + (config.help ? 'issue-cli-help.txt' : 'issue-cli-usage.txt')).toString('UTF-8');
                console.log(helptext);
            } else if (!!plugins[command]) {
                cliParams.shift();
                var subCommand = cliParams.shift();
                return plugins[command](config, subCommand);
            } else if (plugins[command] === false) {
                console.log('The ' + command + ' plugin disabled. You can re-enable it with:\n\n\tissue config plugins.' + command + '.enabled true\n');
            } else {
                console.log('Don\'t understand that command... sorry :-/');
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
    function commandConfig(cliParams, issueConfig, helper, userConfigFlag) {

        // switch the number of sub-commands
        switch (cliParams.slice(1).length) {

            case 0:
                // list all config options
                console.log(userConfigFlag ? '** not yet implemented for userconfig **' : issueConfig.list());
                break;

            case 1:
                // list config option specified in first sub-command
                console.log(userConfigFlag ? '** not yet implemented for userconfig **' : issueConfig(cliParams[1]));
                break;

            case 2:
                // if first sub-command is `remove` then remove from config, key specified in second sub-command
                // else set key/value as first/second sub-command
                if (cliParams[1] === 'remove') {
                    helper.promptYesNo('Are you sure you want to write new config to disk? [Yn]', function () {
                        issueConfig(cliParams[2], null, userConfigFlag);
                    }, helper.chalk.red('aborted config change'), 'y');
                } else {
                    helper.promptYesNo('Are you sure you want to write new config to disk? [Yn]', function () {
                        issueConfig(cliParams[1], cliParams[2], userConfigFlag);
                    }, helper.chalk.red('aborted config change'), 'y');
                }
                break;
        }
    }

}();