'use strict';

module.exports = (function () {

    var pluginHelper = {
        issueHelper: issueHelperFactory(mockConfig),
        issueHelperFactory: issueHelperFactory,
        mockConfig: mockConfig
    };

    pluginHelper.issuemd = getIssuemd(pluginHelper.issueHelper, mockConfig());

    return pluginHelper;

    function mockConfig() {
        return {};
    }

    function issueHelperFactory(config) {
        var issueHelperProxy = require('../src/issue-helper.js')(config);
        issueHelperProxy.ajax = require('./mock.js')(issueHelperProxy.ajax, process.env.npm_config_record ? 'record' : 'lockdown'); // jshint ignore:line
        return issueHelperProxy;
    }

    function getIssuemd(issueHelper, config) {

        var chalk = issueHelper.chalk,
            issuemd = require('issuemd');

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

        return issuemd;

    }

})();
