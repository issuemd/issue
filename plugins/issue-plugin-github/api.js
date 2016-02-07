'use strict';

module.exports = function () {

    return function (config, helper) {

        var _ = require('underscore');

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
            search: search,
            getIssues: getIssues,
            getIssue: getIssue,
            getIssueComments: getIssueComments,
            getIssueEvents: getIssueEvents,
            getPersonalIssues: getPersonalIssues,
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

        function search(project, filters) {
            var url = '/search/repositories?q=' + (project || '');
            return ajaxWrapper(url, null, filters);
        }


        // q   string  The search terms.
        // sort    string  The sort field. Can be comments, created, or updated. Default: results are sorted by best match.
        // order   string  The sort order if sort parameter is provided. One of asc or desc. Default: desc
        function searchIssues (q, sort, order) {
            var url = '/search/issues?q=' + (q || '');
            if(_.contains(['comments', 'created', 'updated'], sort)){
                url += '&sort=' + sort;
            }
            if(_.contains(['asc', 'desc'], order)){
                url += '&order=' + order;
            }
            return ajaxWrapper(url);
        }

        function getIssues(user, repository, filters) {
            var url = '/repos/' + user + '/' + repository + '/issues';
            return ajaxWrapper(url, null, filters);
        }

        function getIssue(user, repository, number) {
            var url = '/repos/' + user + '/' + repository + '/issues' + '/' + number;
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

            var options = _.extend({}, apiDefaults, opts);

            // if Basic Auth is not present, check for existing access token
            if (!/[?&]access_token=/.test(url) && (!options.headers || !options.headers.Authorization) && config.plugins && config.plugins.github && config.plugins.github.authToken) {
                url += (/\?/.test(url) ? '&' : '?') + 'access_token=' + config.plugins.github.authToken;
            }

            if (options.method === 'GET' && body) {
                _.each(body, function (value, key) {
                    url += (/\?/.test(url) ? '&' : '?') + key + '=' + value;
                });
            }

            var promise = helper.ajax(url, options, body);

            promise.then(function (response) {
                if (response.headers['x-ratelimit-remaining'] * 1 < 5) {
                    console.log('Github api calls remaining: ' + response.headers['x-ratelimit-remaining']);
                }
            });

            promise.fail(function (error) {
                if (error.response.headers['x-ratelimit-remaining'] === '0') {
                    console.log('Rate limit exceeded');
                }
            });

            return promise;

        }

    };

}();
