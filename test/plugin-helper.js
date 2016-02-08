'use strict';

module.exports = (function () {

    return {
        issueHelper: issueHelperFactory(mockConfig),
        issueHelperFactory: issueHelperFactory,
        mockConfig: mockConfig
    };

    function mockConfig() {
        return {};
    }

    function issueHelperFactory(config) {
        var issueHelperProxy = require('../src/issue-helper.js')(config);
        issueHelperProxy.ajax = require('./mock.js')(issueHelperProxy.ajax, process.env.npm_config_record ? 'record' : 'lockdown'); // jshint ignore:line
        return issueHelperProxy;
    }

})();
