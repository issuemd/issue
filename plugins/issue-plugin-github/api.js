'use strict';

module.exports = function () {

    return function (config, helper) {

        var _ = require('underscore'),
            Q = require('q');

        var apiDefaults = {
            host: 'api.github.com',
            port: 443,
            path: '',
            method: 'GET',
            headers: {
                'User-Agent': 'issuemd/issue',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json;charset=UTF-8'
            }
        };

        /* * * * * * * * * * * * * * *
         * Publicly exposed methods  *
         * * * * * * * * * * * * * * */

        return {
            nextPage: nextPage,
            createAuthToken: createAuthToken,
            getAuthTokens: getAuthTokens,
            rateLimit: rateLimit,
            revokeAuthToken: revokeAuthToken,
            getIssues: getIssues,
            getIssue: getIssue,
            getIssuePullRequests: getIssuePullRequests,
            getIssueComments: getIssueComments,
            getIssueEvents: getIssueEvents,
            getPersonalIssues: getPersonalIssues,
            searchRepositories: searchRepositories,
            searchIssues: searchIssues
        };

        function nextPage(url) {
            return ajaxWrapper(url);
        }

        function createAuthToken(username, password, scopes, tokenName) {

            var url = '/authorizations';

            var options = _.defaults({}, apiDefaults);

            options.method = 'POST';
            options.headers = options.headers || {};
            options.headers.Authorization = 'Basic ' + helper.toBase64(username + ':' + password);

            var body = {
                scopes: scopes,
                note: tokenName
            };

            return ajaxWrapper(url, options, body);

        }

        function rateLimit() {
            var url = '/rate_limit';
            return ajaxWrapper(url);
        }

        function revokeAuthToken(username, password, tokenId) {

            var url = '/authorizations/' + tokenId;

            var options = _.defaults({}, apiDefaults);

            options.method = 'DELETE';
            options.headers = options.headers || {};
            options.headers.Authorization = 'Basic ' + helper.toBase64(username + ':' + password);

            return ajaxWrapper(url, options);

        }

        function getAuthTokens(username, password) {

            var url = '/authorizations';

            var options = _.defaults({}, apiDefaults);

            options.headers = options.headers || {};
            options.headers.Authorization = 'Basic ' + helper.toBase64(username + ':' + password);

            return ajaxWrapper(url, options);

        }

        function searchRepositories(q, filters) {
            var url = '/search/repositories?q=' + (q || '');
            return ajaxWrapper(url, null, filters);
        }

        function searchIssues(q, repo, filters) {
            var url = '/search/issues?q=' + (q || '') + (repo ? '+repo:' + repo.namespace + '/' + repo.id : '');
            return ajaxWrapper(url, null, filters);
        }

        function getIssues(user, repository, filters) {
            var url = '/repos/' + user + '/' + repository + '/issues';
            return ajaxWrapper(url, null, filters);
        }

        function getIssue(user, repository, number) {
            var url = '/repos/' + user + '/' + repository + '/issues' + '/' + number;
            return ajaxWrapper(url);
        }

        function getIssuePullRequests(user, repository, number) {
            var url = '/repos/' + user + '/' + repository + '/pulls/' + number;
            return ajaxWrapper(url);
        }

        function getIssueComments(user, repository, number) {
            var url = '/repos/' + user + '/' + repository + '/issues/' + number + '/comments';
            return ajaxWrapper(url);
        }

        function getIssueEvents(user, repository, issueNumber) {
            var url = '/repos/' + user + '/' + repository + '/issues/' + issueNumber + '/events';
            return ajaxWrapper(url);
        }

        function getPersonalIssues(filters) {
            var url = '/issues';
            return ajaxWrapper(url, {}, filters);
        }


        /* * * * * * * * * * *
         * Helper functions  *
         * * * * * * * * * * */

        function ajaxWrapper(url, opts, body) {

            var options = _.extend({}, apiDefaults, opts),
                deferred = new Q.defer();

            // if Basic Auth is not present, check for existing access token
            if (!/[?&]access_token=/.test(url) && (!options.headers || !options.headers.Authorization) && config.plugins && config.plugins.github && config.plugins.github.authToken) {
                url += (/\?/.test(url) ? '&' : '?') + 'access_token=' + config.plugins.github.authToken;
            }

            if (config['api-per-page'] && !/[?&]per_page=/.test(url)) {
                url += (/\?/.test(url) ? '&' : '?') + 'per_page=' + config['api-per-page'];
            }

            if (options.method === 'GET' && body) {
                _.each(body, function (value, key) {
                    url += (/\?/.test(url) ? '&' : '?') + key + '=' + value;
                });
            }

            helper.ajax(url, options, body).then(function (response) {
                    if (response.headers['x-ratelimit-remaining'] * 1 < 4950) {
                        deferred.notify({
                            stdout: 'Github api calls remaining: ' + response.headers['x-ratelimit-remaining']
                        });
                    }
                    deferred.resolve(response);
                })
                .fail(function (error) {
                    if (error.response.headers['x-ratelimit-remaining'] === '0') {
                        deferred.notify({
                            stderr: 'Rate limit exceeded'
                        });
                    }
                    deferred.reject(error);
                });

            return deferred.promise;

        }

    };

}();
