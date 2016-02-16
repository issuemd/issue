'use strict';

! function () {

    module.exports = function (issueConfig, helper) {

        var localConfig = issueConfig();
        var api = require('./api.js')(localConfig, helper);
        var _ = require('underscore');
        var Q = require('q');

        // ******************************************
        // ISSUEMD GITHUB FUNCTIONS
        // ******************************************

        return {
            // api proxies
            rateLimit: api.rateLimit,
            searchRepository: api.searchRepositories,
            nextPage: api.nextPage,
            listIssues: api.getIssues,
            searchIssues: api.searchIssues,
            // api calling methods
            fetchIssue: fetchIssue,
            login: login,
            // helpers
            generateTokenName: generateTokenName,
            removeCredentials: removeCredentials,
            nextPageUrl: nextPageUrl,
            autoDetectRepo: autoDetectRepo,
            pages: pages
            // fetchNextPage!!
            // TODO: decide how to re-implement personal issues
            // listPersonalIssues: api.getPersonalIssues,
        };

        // ******************************************
        // LOGOUT
        // ******************************************

        function removeCredentials() {
            try {
                issueConfig('plugins.github.authToken', '', true);
                issueConfig('plugins.github.authTokenId', '', true);
                return Q.resolve();
            } catch (e) {
                return Q.reject(e);
            }
        }

        // ******************************************
        // LOGIN
        // ******************************************

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

        function login(username, password, tokenName) {

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

        // ******************************************
        // ISSUES
        // ******************************************

        function fetchIssue(user, repository, number) {

            return api.getIssue(user, repository, number).then(function (response) {

                var issue = response.data;

                var requests = [
                    api.getIssueEvents(user, repository, number).then(pages),
                    api.getIssueComments(user, repository, number).then(pages)
                ].concat(issue.pull_request ? api.getIssuePullRequests(user, repository, number) : []); // jshint ignore:line

                return Q.all(requests).spread(function (events, comments, pullRequests) {

                    issue.comments = comments;
                    issue.events = events;

                    if (pullRequests && pullRequests.data.updated_at) { // jshint ignore:line

                        issue.events.push({
                            event: 'pull_request',
                            actor: {
                                login: pullRequests.data.user.login
                            },
                            created_at: pullRequests.data.updated_at // jshint ignore:line
                        });

                    } else {

                        var lastCommentOrEventUpdate = issue.events.reduce(function (memo, item) {
                            return item.event !== 'referenced' && new Date(item.created_at) > new Date(memo) ? item.created_at : memo; // jshint ignore:line
                        }, issue.comments.length && issue.comments[issue.comments.length - 1].updated_at); // jshint ignore:line

                        var calculatedUpdateTime;

                        if (!lastCommentOrEventUpdate && issue.created_at !== issue.updated_at) { // jshint ignore:line
                            calculatedUpdateTime = issue.updated_at; // jshint ignore:line
                        } else if (!!lastCommentOrEventUpdate && new Date(issue.updated_at) > new Date(lastCommentOrEventUpdate)) { // jshint ignore:line
                            calculatedUpdateTime = issue.updated_at; // jshint ignore:line
                        }

                        if (!!calculatedUpdateTime) { // jshint ignore:line
                            var newevent = {
                                event: 'update',
                                actor: {
                                    login: issue.user.login
                                },
                                created_at: calculatedUpdateTime // jshint ignore:line
                            };
                            issue.events.push(newevent);
                        }

                    }

                    return issue;

                });

            });

        }

        // ******************************************
        // HELPERS
        // ******************************************

        function pages(response) {

            var data = [];

            return success(response);

            function success(response) {
                data = data.concat(response.data);
                var pages = nextPageUrl(response);
                return pages.next && api.nextPage(pages.next.url).then(success) || data;
            }

        }

        function nextPageUrl(response) {

            var urls = {};

            if (response.headers && response.headers.link) {
                // http://regexper.com/#/<(.*?(\d+))>;\s*rel="(.*?)"/g
                response.headers.link.replace(/<(.*?(\d+))>;\s*rel="(.*?)"/g, function (_, url, page, name) {
                    urls[name] = {
                        url: url,
                        page: page * 1
                    };
                });
            }

            return urls;

        }

        function autoDetectRepo(configRepo, configAutoDectect, configGitRemote) {

            // use --repo in form `issuemd/issue` if set, otherwise...
            // auto detect github repo, and populate config accordingly

            var repo, parts;

            if (!!configRepo) {
                parts = configRepo.split('/');
                repo = {
                    namespace: parts[0],
                    id: parts[1]
                };
            } else if (configAutoDectect && configGitRemote) {
                // http://regexper.com/#%2F%5Egit%40github%5C.com%3A(%5B%5Cw.-%5D%2B)%5C%2F(%5B%5Cw.-%5D%2B)%5C.git%24%2F
                // http://regexper.com/#%2F%5Ehttps%3F%3A%5C%2F%5C%2Fgithub%5C.com%5C%2F(%5B%5Cw.-%5D%2B)%5C%2F(%5B%5Cw.-%5D%2B)(%3F%3A%5C.git)%3F%5C%2F%3F%24%2F
                parts = configGitRemote.match(/^git@github\.com:([\w.-]+)\/([\w.-]+)\.git$/) ||
                    configGitRemote.match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/);
                if (!!parts) {
                    repo = {
                        namespace: parts[1],
                        id: parts[2]
                    };
                }
            }
            return repo;
        }


    };

}.call(null);
