module.exports = (function () {

    'use strict';

    var path = require('path'),
        fs = require('fs');

    var _ = require('underscore');

    // TODO: figure out best way to require dependencies
    var src = path.join(path.dirname(fs.realpathSync(__filename)), '../..'),
        config = require(src + '/issue-config.js').init(process.argv)(),
        helper = require(src + '/issue-helper.js')(config.tech),
        defaultAnswer = 'n';

    return resultHandler(require(src + '/issue-cli.js').run(process.argv));

    function resultHandler(result) {

        // if result is string, log it
        // else assume it's a promise and handle it
        if (typeof result === 'string') {
            console.log(result);
        } else {

            // TODO: remove condition - throw error if not then-able
            result && result.then && result.progress(output).then(output).then(function (result) {
                if (result && result.next) {
                    if (!config.answer || config.answer === 'ask') {
                        helper.promptYesNo('Load next page? ' + (defaultAnswer === 'n' ? '[yN]' : '[nY]'), function () {
                            defaultAnswer = 'y';
                            resultHandler(result.next());
                        }, null, defaultAnswer);
                    } else if (!!config.answer && helper.yesno(config.answer)) {
                        resultHandler(result.next());
                    }
                }
            }).fail(function (error) {
                // {stderr:'Writing config failed'}
                // 'Error: not able write to userconfig - probably need to create config file in home directory:\n\n\tcd ' + (process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME) + '\n\tissue init\n'
                console.error('Error: ' + error.message || error);
            });

        }

    }

    function output(result) {
        _.each(['stdout', 'stderr'], function (item) {
            if (result && _.isArray(result[item])) {
                result[item] = result[item].join('\n');
            }
        });
        result && result.stdout && console.log(result.stdout);
        result && result.stderr && process.stderr.write(result.stderr + '\n');
        return result;
    }

})();
