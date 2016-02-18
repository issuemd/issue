(function () {

    'use strict';

    module.exports = function (issueConfig, helper, api) {

        var hostname = require('os').hostname(),
            _ = require('underscore'),
            Q = require('q'),
            logout = require('./logout.js')(issueConfig);

        return function (config) {

            // TODO: replace this functionality - rely on --username and --password
            var username = config.params[0],
                password = config.params[1];

            // first logout, which ensures userconfig is writable
            return logout().then(function () {
                // if somebody already typed in username and password
                return helper.captureCredentials(username, password);
            }).then(function (credentials) {
                return doLogin(credentials.username, credentials.password, generateTokenName(credentials.username, hostname));
            }).then(function (result) {
                return {
                    stderr: result
                };
            });

        };

        function generateTokenName(username, hostname) {
            return 'issuemd/issue-' + username + '@' + hostname;
        }

        function writeGithubToken(token, tokenId) {
            try {
                issueConfig('plugins.github.authToken', token, true);
                issueConfig('plugins.github.authTokenId', tokenId, true);
                return Q.resolve();
            } catch (e) {
                return Q.reject(e);
            }
        }

        function doLogin(username, password, tokenName) {

            return api.getAuthTokens(username, password)
                .then(function (tokens) {

                    var token = _.find(tokens, function (auth) {
                        return auth.note === tokenName;
                    });

                    var tokenId = token && token.id;

                    return api.revokeAuthToken(username, password, tokenId);

                }).then(function () {
                    return api.createAuthToken(username, password, tokenName);
                }).then(function (loginData) {
                    return writeGithubToken(loginData.token, loginData.id);
                }).then(function () {
                    return 'Login Success!';
                });

        }

    };

})();
