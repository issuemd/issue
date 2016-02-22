(function () {

    'use strict';

    module.exports = function (helper, api) {

        var hostname = require('os').hostname(),
            _ = require('underscore'),
            Q = require('q'),
            logout = require('./logout.js')(helper);

        return function (config) {

            // first logout, which ensures userconfig is writable
            return logout().then(function () {
                // if somebody already typed in username and password
                return helper.captureCredentials(config.username, config.password);
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
                helper.configGenerator('plugins.github.authToken', token, true);
                helper.configGenerator('plugins.github.authTokenId', tokenId, true);
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
