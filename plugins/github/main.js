'use strict';

! function () {

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var localConfig = issueConfig();
        var templates = issueTemplates(helper.chalk);
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
                    return 'The issue was referenced from a commit message';
                }
            };

            if (!!handlers[evt.event]) {
                update.body = handlers[evt.event](evt);
            }

            this.filter('number', issueNo + '')
                .update(update);

        };

        issuemd.fn.addFromGithubJson = function (gitIssue) { // jshint maxcomplexity:15

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

            if (gitIssue.state) {
                attr.status = gitIssue.state;
            }

            if (gitIssue.number) {
                attr.number = gitIssue.number;
            }

            if (gitIssue.locked) {
                attr.locked = gitIssue.locked;
            }

            if (gitIssue.assignee) {
                attr.assignee = gitIssue.assignee.login;
            }

            if (gitIssue.updated_at) { // jshint ignore:line
                attr.updated = helper.dateStringToIso(gitIssue.updated_at); // jshint ignore:line
            }

            if (typeof gitIssue.pull_request !== 'undefined') { // jshint ignore:line
                attr.pull_request_url = gitIssue.pull_request.url; // jshint ignore:line
            }

            if (typeof gitIssue.milestone !== 'undefined' && gitIssue.milestone !== null) {
                attr.milestone = gitIssue.milestone.title;
            }

            // closed attribute added only if defined
            if (typeof gitIssue.closed !== 'undefined') {
                attr.closed = helper.dateStringToIso(gitIssue.closed_at); // jshint ignore:line
            }

            // labels get concatenated to comma delimited string
            if (gitIssue.labels.length > 0) {
                var labelArray = gitIssue.labels.map(function (label) {
                        return label.name;
                    })
                    .toString();

                attr.labels = labelArray;
            }

            issue.attr(attr);

            this.merge(issue);

        };


        return function (config, command) {

            var filters, args;

            var deferred = Q.defer();

            // unless disabled, assueme autodetect is true
            var repo = autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);

            switch (command) {
                case 'limit':

                    rateLimit()
                        .then(rateLimitSuccess)
                        .fail(responseError);

                    break;

                case 'login':

                    (function () {

                        // first logout, which ensures userconfig is writable
                        try {
                            removeCredentials();
                        } catch (e) {
                            console.log('Error: not able write to userconfig - probably need to create config file in home directory:\n\n\tcd ' + (process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME) + '\n\tissue init\n');
                            return;
                        }

                        var credentials;

                        captureCredentials(config.params[0], config.params[1])
                            .then(function (capturedCredentials) {
                                credentials = capturedCredentials;
                                return credentials;
                            })
                            .then(getExistingTokens)
                            .then(function (token) {
                                return removeExistingToken(credentials, token);
                            })
                            .then(function () {
                                return githubLogin(credentials);
                            })
                            .then(loginSuccess)
                            .fail(loginError);

                    })();

                    break;

                case 'logout':
                    removeCredentials();
                    break;

                case 'search':

                    // first parameter is project name, all other are search filters
                    filters = _.pick(config, 'in', 'size', 'forks', 'fork', 'created', 'pushed', 'user', 'repo', 'language', 'stars');

                    searchRepository(config.params[0], filters)
                        .then(function (response) {
                            searchSuccess(response);
                            fetchNextPage(response.headers, searchSuccess, responseError, function () {
                                deferred.resolve();
                            }, config.answer || 'ask');
                        })
                        .fail(responseError);

                    break;

                case 'list':
                case 'show':

                    filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

                    if (!!repo && config.params.length === 0) {

                        listIssues(repo.namespace, repo.id, filters)
                            .then(function (response) {
                                listSuccess(response);
                                fetchNextPage(response.headers, listSuccess, responseError, function () {
                                    deferred.resolve();
                                }, config.answer || 'ask');
                            })
                            .fail(responseError);

                    } else if (config.params.length === 1 && config.params[0] === 'mine') {

                        listPersonalIssues(filters)
                            .then(function (response) {
                                listSuccess(response);
                                fetchNextPage(response.headers, listSuccess, responseError, function () {
                                    deferred.resolve();
                                }, config.answer || 'ask');
                            })
                            .fail(responseError);

                    } else if (!!repo && config.params.length === 1 && command === 'show') {

                        // $ issue --repo moment/moment github search 2805
                        args = [repo.namespace, repo.id, config.params[0], filters];

                        fetchIssue.apply(this, args)
                            .then(function (response) {
                                var issues = fetchIssueSuccess(response);
                                // See here for more CLI window size hints: http://stackoverflow.com/a/15854865/665261
                                var templateOptions = _.pick(localConfig, 'dim');
                                console.log(issues.toString(localConfig.width, templates.issuesContentTableLayoutTechnicolor(templateOptions)));
                            })
                            .then(function () {
                                deferred.resolve();
                            })
                            .fail(responseError);
                    } else {
                        console.log([
                            'Usage:',
                            '',
                            '  issue github list mine',
                            '  issue github list --repo <namespace/project>',
                            '  issue github show --repo <namespace/project> <id>',
                            '',
                            'Example:',
                            '',
                            '  issue github show --repo victorquinn/chancejs 207',
                            ''
                        ].join('\n'));
                    }

            }

            return deferred.promise;

        };



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




        // ******************************************
        // RATE LIMIT
        // ******************************************

        function rateLimit() {
            return api.rateLimit();
        }

        function displayStatus(name, remaining, limit, reset) {
            var w = helper.chalk.white;
            var g = helper.chalk.green;
            console.log(w(name + ' requests: ') + colorLimit(remaining, limit) + w('/' + limit + ', resets in: ') + g(getMinutes(reset)) + w(' mins'));
        }

        function colorLimit(value, limit) {

            var color;

            var currentState = value / limit;

            if (currentState < 0.33) {
                color = helper.chalk.red;
            } else if (currentState < 0.66) {
                color = helper.chalk.yellow;
            } else {
                color = helper.chalk.green;
            }

            return color(value);

        }

        function getMinutes(date) {
            return Math.ceil((date * 1000 - new Date()) / 1000 / 60);
        }

        function rateLimitSuccess(response) {

            _.each(response.data.resources, function (value, name) {
                displayStatus(name, value.remaining, value.limit, value.reset);
            });

        }




        // ******************************************
        // LOGIN
        // ******************************************

        function githubLogin(credentials) {
            var scopes = ['user', 'repo', 'gist'];
            return api.createAuthToken(credentials.username, credentials.password, scopes, generateGithubTokenName());
        }

        function removeExistingToken(credentials, token) {

            var deferred = Q.defer();

            if (token) {

                api.revokeAuthToken(credentials.username, credentials.password, token.id)
                    .then(function (response) {
                        deferred.resolve(response);
                    })
                    .fail(function (error) {
                        deferred.reject(error);
                    });

            } else {
                deferred.resolve({});
            }

            return deferred.promise;

        }

        function getExistingTokens(credentials) {

            var deferred = Q.defer();

            api.getAuthTokens(credentials.username, credentials.password)
                .then(function (response) {

                    var token = _.find(response.data, function (auth) {
                        return auth.note === generateGithubTokenName();
                    });

                    deferred.resolve(token);

                })
                .fail(function (error) {
                    deferred.reject(error);
                });

            return deferred.promise;

        }

        function loginSuccess(response) {
            var loginResponse = response.data;

            issueConfig('plugins.github.authToken', loginResponse.token, true);
            issueConfig('plugins.github.authTokenId', loginResponse.id, true);

            var msg = helper.chalk.green('Login success');
            console.log(msg);
        }

        function loginError(response) {
            if (response.error === 422) {

                var message = response.body.message + ', ' + response.body.errors.map(function (error) {
                    return error.resource + ': ' + error.code;
                }).join(',');
                console.log(message);

                var title = helper.chalk.red('Authorization token in your .issuerc file seems to be out of date.');
                console.log('\n' + title);
                console.log('To refresh the authorization token on this computer, please logout and login again');
            } else {
                responseError(response);
            }
        }



        // ******************************************
        // LOGOUT
        // ******************************************

        function removeCredentials() {
            issueConfig('plugins.github.authToken', '', true);
        }



        // ******************************************
        // SEARCH
        // ******************************************

        function searchRepository(project, filters) {

            var warning;
            var deferred = Q.defer();

            if (localConfig.plugins && localConfig.plugins.github && !localConfig.plugins.github.authToken) {
                var g = helper.chalk.gray;
                warning = g('Warning, user not logged in, private repositories are not listed...');
                console.log(warning);
            }

            if (!project) {
                warning = helper.chalk.gray('You must specifiy user/organization and repository name...');
                deferred.reject(warning);
            } else {
                api.search(project, filters)
                    .then(function (response) {
                        deferred.resolve(response);
                    })
                    .fail(function (error) {
                        deferred.reject(error);
                    });
            }

            return deferred.promise;

        }

        function searchSuccess(response) {

            var result = response.data;
            _.each(result.items, function (repo) {
                var red = helper.chalk.red;
                var grey = helper.chalk.grey;
                var name = repo.owner.login + ' ' + red(repo.name) + grey(' (' + repo.ssh_url + ')'); // jshint ignore:line
                console.log(name);
            });
            return response;
        }



        // ******************************************
        // ISSUES LIST (via show command)
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

        function listSuccess(response) {

            var data = response.data;
            var issues = issuemd();
            var githubIssues = _.isArray(data) ? data : [data];

            _.each(githubIssues, function (githubIssue) {

                var issue = issuemd({})
                    .attr({
                        title: githubIssue.title,
                        creator: helper.personFromParts({
                            username: githubIssue.user.login
                        }),
                        created: helper.dateStringToIso(githubIssue.created_at), // jshint ignore:line
                        body: githubIssue.body,
                        id: githubIssue.number,
                        assignee: githubIssue.assignee ? githubIssue.assignee.login : 'unassigned',
                        status: githubIssue.state || ''
                    });

                issues.merge(issue);

            });

            var templateOptions = _.pick(localConfig, 'dim');
            console.log(issues.summary(localConfig.width, templates.issuesSummaryTechnicolor(templateOptions)));

        }



        // ******************************************
        // PERSONAL ISSUES
        // ******************************************

        function listPersonalIssues(filters) {
            return api.getPersonalIssues(filters);
        }



        // ******************************************
        // SINGLE ISSUE
        // ******************************************

        function fetchIssue(user, repository, number) {

            var deferred = Q.defer();

            api.getIssue(user, repository, number)
                .then(function (response) {

                    var issue = response.data;

                    // fetch all comments and add them to the queue
                    fetchIssueComments(user, repository, number)
                        .then(function (comments) {
                            issue.comments = comments;
                            fetchIssueEvents(user, repository, number)
                                .then(function (events) {
                                    issue.events = events;
                                    deferred.resolve(issue);
                                });
                        });

                })
                .fail(function (error) {
                    deferred.reject(error);
                });

            return deferred.promise;

        }

        function fetchIssueComments(user, repository, number) {

            var deferred = Q.defer();
            var comments = [];

            api.getIssueComments(user, repository, number)
                .then(function (response) {

                    onSuccess(response);
                    fetchNextPage(response.headers, onSuccess, onError, onComplete, false);

                });

            function onSuccess(response) {
                var jsonComments = response.data;
                comments = comments.concat(jsonComments);
            }

            function onError(error) {
                deferred.reject(error);
            }

            function onComplete() {
                deferred.resolve(comments);
            }

            return deferred.promise;

        }

        function fetchIssueEvents(user, repository, number) {

            var deferred = Q.defer();
            var events = [];

            api.getIssueEvents(user, repository, number)
                .then(function (response) {

                    onSuccess(response);
                    fetchNextPage(response.headers, onSuccess, onError, onComplete, false);

                });

            function onSuccess(response) {
                var jsonEvents = response.data;
                events = events.concat(jsonEvents);
            }

            function onError(error) {
                deferred.reject(error);
            }

            function onComplete() {
                deferred.resolve(events);
            }

            return deferred.promise;

        }

        function fetchIssueSuccess(githubIssue) {

            var issues = issuemd();

            issues.addFromGithubJson(githubIssue);

            if (githubIssue.comments.length > 0) {

                _.each(githubIssue.comments, function (comment) {

                    issues.addGithubComment(githubIssue.number, comment);

                });

            }

            if (githubIssue.events && githubIssue.events.length > 0) {

                _.each(githubIssue.events, function (event) {

                    issues.addGithubEvent(githubIssue.number, event);

                });

            }

            issues.sortUpdates();

            return issues;

        }




        // ******************************************
        // HELPERS
        // ******************************************

        function responseError(error) {
            var errorTitle = helper.chalk.red('*** Error ' + error.error + ' ***');
            console.log(errorTitle);
            console.log(error.message);
        }

        function captureCredentials(username, password) {
            return helper.captureCredentials(username, password);
        }

        function generateGithubTokenName() {
            // inspired by: https://github.com/sindresorhus/username/blob/master/index.js#L14
            var username = process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME;
            return 'issuemd/issue-' + username + '@' + require('os').hostname();
        }

        // recursive function to handle github pagination
        function fetchNextPage(headers, onPageSuccess, onPageError, onComplete, promptAnswer) {

            var pages = getPages(headers);

            // if there are more pages
            if (pages.next) {

                // if no promptAnswer specified, or specified to ask,
                // otherwise read default answer form config
                // or ask for confirmation
                if (!promptAnswer || promptAnswer === 'ask') {
                    helper.promptYesNo('Load more results? [yN]', callApiNextPage, callCompleteCallback);
                } else if (!!promptAnswer) {
                    helper.yesno(promptAnswer) ? callApiNextPage() : callCompleteCallback();
                }

            } else {
                // no pages, call onComplete callback right away
                callCompleteCallback();
            }

            function callCompleteCallback() {
                if (_.isFunction(onComplete)) {
                    onComplete();
                }
            }

            function callApiNextPage() {
                // failure callback handled elsewhere, this call should never fail
                api.nextPage(pages.next)
                    .then(function (response) {
                        // when next page is fetched, execute onPageSuccess callback
                        if (_.isFunction(onPageSuccess)) {
                            onPageSuccess(response);
                        }
                        // check if there are more pages to fetch
                        fetchNextPage(response.headers, onPageSuccess, onPageError, onComplete, promptAnswer);
                    });
            }

        }

        // extract number of pages from the header
        function getPages(headers) {
            var pagination = {};
            if (headers && headers.link) {
                // http://regexper.com/#%2F%3C(.*%3F)%3E%3B%5Cs*rel%3D%22(.*%3F)%22%2Fg
                headers.link.replace(/<(.*?)>;\s*rel="(.*?)"/g, function (_, url, name) {
                    pagination[name] = url;
                });
            }
            return pagination;
        }

    };

}.call(null);