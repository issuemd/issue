(function () {

    'use strict';

    module.exports = function (issueConfig, helper, issuemd) {

        var hostname = require('os').hostname(),
            github = require('../github.js')(issueConfig, helper, issuemd);

        return login;

        function login(config) {

            // TODO: replace this functionality - rely on --username and --password
            var username = config.params[0],
                password = config.params[1];

            // first logout, which ensures userconfig is writable
            return github.removeCredentials().then(function () {
                // if somebody already typed in username and password
                return helper.captureCredentials(username, password);
            }).then(function (credentials) {
                return github.login(credentials.username, credentials.password, github.generateTokenName(credentials.username, hostname));
            }).then(function (result) {
                return {
                    stderr: result
                };
            });

        }

    };

})();
