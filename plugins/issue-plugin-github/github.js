'use strict';

! function () {

    module.exports = function (issueConfig, helper, issuemd) {

        var localConfig = issueConfig();
        var api = require('./api.js')(localConfig, helper);
        var _ = require('underscore');
        var Q = require('q');




        // ******************************************
        // ISSUEMD GITHUB FUNCTIONS
        // ******************************************

        issuemd.fn.addGithubComment = function (issueNo, comment) {

            this.filter('number', issueNo + '')
                .update({
                    body: comment.body,
                    modifier: comment.user.login,
                    modified: helper.dateStringToIso(comment.updated_at), // jshint ignore:line
                    type: 'comment'
                });

        };

        issuemd.fn.addGithubEvent = function (issueNo, evt) {

            var update = {
                body: undefined,
                modifier: evt.actor.login,
                modified: helper.dateStringToIso(evt.created_at), // jshint ignore:line
                type: 'event'
            };

            var handlers = {
                closed: function () {
                    return 'status: closed';
                },
                reopened: function () {
                    return 'status: reopened'; /* evt.actor.login */
                },
                merged: function () {
                    return 'status: merged'; /* evt.actor.login */
                },
                locked: function () {
                    return 'locking: locked'; /* evt.actor.login */
                },
                unlocked: function () {
                    return 'locking: unlocked'; /* evt.actor.login */
                },
                subscribed: function (evt) {
                    return 'subscribed: ' + evt.actor.login;
                },
                mentioned: function (evt) {
                    return 'mentioned: ' + evt.actor.login;
                },
                assigned: function (evt) {
                    return 'assigned: ' + evt.assignee.login;
                },
                unassigned: function (evt) {
                    return 'unassigned: ' + evt.assignee.login;
                },
                labeled: function (evt) {
                    return 'added label: ' + evt.label.name; /* evt.label.color */
                },
                unlabeled: function (evt) {
                    return 'removed label: ' + evt.label.name; /* evt.label.color */
                },
                milestoned: function (evt) {
                    return 'added milestone: ' + evt.milestone.title;
                },
                demilestoned: function (evt) {
                    return 'removed milestone: ' + evt.milestone.title;
                },
                renamed: function (evt) {
                    return 'renamed issue: ' + evt.rename.to; /* evt.rename.from */
                },
                head_ref_deleted: function () { // jshint ignore:line
                    return 'branch: deleted';
                },
                head_ref_restored: function () { // jshint ignore:line
                    return 'branch: restored';
                },
                referenced: function () {
                    update.type = 'reference';
                    return 'The issue was referenced from a commit message';
                },
                // synthesised events
                pull_request: function () { // jshint ignore:line
                    update.type = 'pull-request';
                    return 'pull request opened';
                },
                update: function () { // jshint ignore:line
                    update.type = 'edit';
                    return 'update to issue';
                }
            };

            if (!!handlers[evt.event]) {
                update.body = handlers[evt.event](evt);
            }

            this.filter('number', issueNo + '')
                .update(update);

        };

        issuemd.fn.addFromGithubJson = function (gitIssue) {

            var issue = issuemd({

                title: gitIssue.title,
                creator: helper.personFromParts({
                    username: gitIssue.user.login
                }),
                created: helper.dateStringToIso(gitIssue.created_at), // jshint ignore:line
                body: gitIssue.body,

            });

            var attr = {};

            // http://regexper.com/#/([^/]+?)(?:\/issues\/.+)$/
            var repoName = gitIssue.url.match(/([^/]+?)(?:\/issues\/.+)$/)[1];

            if (repoName) {
                attr.project = repoName;
            }

            var attributes = {
                status: 'state',
                number: 'number',
                locked: 'locked',
                assignee: function () {
                    return gitIssue.assignee && gitIssue.assignee.login;
                },
                updated: function () {
                    return helper.dateStringToIso(gitIssue.updated_at); // jshint ignore:line
                },
                pull_request_url: function () { // jshint ignore:line
                    return gitIssue.pull_request && gitIssue.pull_request.url; // jshint ignore:line
                },
                milestone: function () {
                    return gitIssue.milestone && gitIssue.milestone.title;
                },
                closed: function () {
                    return gitIssue.closed && helper.dateStringToIso(gitIssue.closed_at); // jshint ignore:line
                },
                labels: function () {
                    // labels get concatenated to comma delimited string
                    return gitIssue.labels.length > 0 && gitIssue.labels.map(function (label) {
                        return label.name;
                    }).join(', ');
                }
            };

            for (var i in attributes) {
                var value = typeof attributes[i] === 'function' ? attributes[i]() : gitIssue[attributes[i]];
                if (!!value) {
                    attr[i] = value;
                }
            }

            issue.attr(attr);

            this.merge(issue);

        };



        return {
            rateLimit: rateLimit,
            removeCredentials: removeCredentials,
            createToken: createToken,
            removeToken: removeToken,
            getTokens: getTokens,
            generateTokenName: generateTokenName,
            writeGithubToken: writeGithubToken,
            login: login,
            searchRepository: api.searchRepositories,
            nextPageUrl: nextPageUrl,
            nextPage: api.nextPage,
            autoDetectRepo: autoDetectRepo,
            listIssues: listIssues,
            listPersonalIssues: listPersonalIssues,
            fetchIssue: fetchIssue,
            searchIssues: searchIssues
        };

        // ******************************************
        // RATE LIMIT
        // ******************************************

        function rateLimit() {

            return api.rateLimit().then(function (response) {
                return response.data.resources;
            });

        }



        // ******************************************
        // LOGOUT
        // ******************************************

        function removeCredentials() {
            var deferred = Q.defer();
            try {
                issueConfig('plugins.github.authToken', '', true);
                issueConfig('plugins.github.authTokenId', '', true);
                deferred.resolve();
            } catch (e) {
                deferred.reject(e);
            }
            return deferred.promise;
        }



        // ******************************************
        // LOGIN
        // ******************************************

        function createToken(username, password, token) {
            var deferred = Q.defer();
            var scopes = ['user', 'repo', 'gist'];

            api.createAuthToken(username, password, scopes, token)
                .then(function (response) {
                    deferred.resolve(response.data);
                })
                .fail(function (error) {
                    deferred.reject({
                        error: error.error,
                        message: error.message
                    });
                });

            return deferred.promise;
        }

        function getTokens(username, password) {
            var deferred = Q.defer();

            api.getAuthTokens(username, password)
                .then(function (response) {
                    deferred.resolve(response.data);
                })
                .fail(function (error) {
                    deferred.reject(error);
                });

            return deferred.promise;
        }

        function removeToken(username, password, tokenId) {
            var deferred = Q.defer();

            if (!tokenId) {
                deferred.resolve({});
            } else {
                api.revokeAuthToken(username, password, tokenId)
                    .then(function (response) {
                        deferred.resolve(response);
                    })
                    .fail(function (error) {
                        deferred.reject(error);
                    });
            }

            return deferred.promise;
        }

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

            var deferred = Q.defer();

            getTokens(username, password)
                .then(function (tokens) {

                    var token = _.find(tokens, function (auth) {
                        return auth.note === tokenName;
                    });

                    return (token && token.id) ? token.id : undefined;

                })
                .then(function (tokenId) {

                    removeToken(username, password, tokenId)
                        .then(function () {

                            createToken(username, password, tokenName)
                                .then(function (loginData) {

                                    writeGithubToken(loginData.token, loginData.id)
                                        .then(function () {
                                            deferred.resolve('Login Success!');
                                        })
                                        .fail(deferred.reject);

                                })
                                .fail(function (error) {
                                    deferred.reject({
                                        error: error.error,
                                        message: error.message
                                    });
                                });
                        })
                        .fail(function (error) {
                            deferred.reject({
                                error: error.error,
                                message: error.message
                            });
                        });

                })
                .fail(function (error) {
                    deferred.reject({
                        error: error.error,
                        message: error.message
                    });
                });

            return deferred.promise;
        }



        // ******************************************
        // ISSUES SEARCH
        // ******************************************

        function searchIssues(searchTerm, repo, filters) {

            var deferred = Q.defer();

            api.searchIssues(searchTerm, repo, filters)
                .then(function (response) {
                    deferred.resolve(response);
                })
                .fail(function (error) {
                    deferred.reject({
                        error: error.error,
                        message: error.message
                    });
                });

            return deferred.promise;

        }



        // ******************************************
        // ISSUES
        // ******************************************

        function listIssues(user, repository, filters) {

            var deferred = Q.defer();

            if (!user || !repository) {
                var warning = helper.chalk.gray('You must specifiy user/organization and repository name...');
                deferred.reject(warning);
            } else {
                return api.getIssues(user, repository, filters);
            }

            return deferred.promise;

        }

        function listPersonalIssues(filters) {
            return api.getPersonalIssues(filters);
        }

        function fetchIssuePullRequests(user, repository, number) {

            return api.getIssuePullRequests(user, repository, number);

        }

        function getCommentsAndEvents(user, repository, number, issue, deferred) {

            // fetch all comments and add them to the queue
            fetchAll(api.getIssueComments, [user, repository, number])
                .then(function (comments) {
                    issue.comments = comments;
                    return fetchAll(api.getIssueEvents, [user, repository, number]).then(function (events) {
                        issue.events = events;
                    });
                })
                .then(handlePullRequests);

            function handlePullRequests() {
                if (!!issue.pull_request) { // jshint ignore:line
                    fetchIssuePullRequests(user, repository, number)
                        .then(function (response) {
                            if (response.data.updated_at) { // jshint ignore:line
                                issue.events.push({
                                    event: 'pull_request',
                                    actor: {
                                        login: response.data.user.login
                                    },
                                    created_at: response.data.updated_at // jshint ignore:line
                                });
                            }
                            deferred.resolve(issue);
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

                    deferred.resolve(issue);

                }
            }

        }

        function fetchIssue(user, repository, number) {

            var deferred = Q.defer();

            api.getIssue(user, repository, number)
                .then(function (response) {

                    var issue = response.data;

                    getCommentsAndEvents(user, repository, number, issue, deferred);

                })
                .fail(function (error) {
                    deferred.reject(error);
                });

            return deferred.promise;

        }



        // ******************************************
        // HELPERS
        // ******************************************

        function fetchAll(apiFunction, args) {

            var events = [];

            return apiFunction.apply(null, args).then(success);

            function success(response) {

                events = events.concat(response.data);

                var pages = nextPageUrl(response);

                return pages.next && api.nextPage(pages.next.url).then(success) || events;

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
