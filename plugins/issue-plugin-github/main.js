'use strict';

! function () {

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var HOSTNAME = require('os').hostname();

        var _ = require('underscore'),
            Q = require('q');

        var github = require('./github.js')(issueConfig, helper, issuemd);

        var localConfig = issueConfig(),
            templates = issueTemplates(helper.chalk),
            filters = _.pick(localConfig, ['in', 'size', 'forks', 'fork', 'created', 'pushed', 'user', 'repo', 'language', 'stars', 'sort', 'order']);

        var githubCli = function (config, command) {

            if (localConfig.plugins && localConfig.plugins.github && !localConfig.plugins.github.authToken) {
                console.log(helper.chalk.red('notice: ') + helper.chalk.gray('user not logged in, private data is not listed'));
            }

            var deferred = Q.defer();
            var loadMore = config.answer || 'ask';

            var commands = {
                limit: function () {
                    limit()
                        .then(deferred.resolve);
                },
                login: function () {
                    login(config.params[0], config.params[1])
                        .then(deferred.resolve);
                },
                logout: function () {
                    github.removeCredentials();
                    deferred.resolve();
                },
                locate: function () {
                    locate(config, filters, loadMore)
                        .then(deferred.resolve);
                },
                search: function () {
                    search(config, filters, loadMore)
                        .then(deferred.resolve);
                },
                show: function () {
                    showIssues(config, command, loadMore)
                        .then(deferred.resolve);

                },
                mine: function () {
                    showMyIssues(filters, loadMore)
                        .then(deferred.resolve);
                },
                export: function () {
                    handleExport(config)
                        .then(deferred.resolve);
                },
            };
            commands.list = commands.show;

            if (commands[command]) {
                commands[command]();
            } else {
                console.log([
                    'Unknown command',
                    '',
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

            return deferred.promise;

        };

        githubCli.helptext = [
            'Search for repos, list issues for repo, and display issue details...',
            '',
            '  issue github search <search-term>                  - search github for repo',
            '  issue github show --repo <namespace/project>       - list issues for repo',
            '  issue github show --repo <namespace/project> <id>  - display specified issue',
            '  issue github limit                                 - display api rate limit',
            '  issue github login                                 - authenticate with github',
            '',
            'e.g.',
            '',
            '  issue github search chancejs',
            '  issue github show --repo victorquinn/chancejs',
            '  issue github show --repo victorquinn/chancejs 207',
            '',
            '  issue github limit',
            '  issue github login',
            '  issue github limit'
        ].join('\n');

        return githubCli;









        // ******************************************
        // LIMIT
        // ******************************************

        function handleExport(config) {

            var deferred = Q.defer();

            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);

            var filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

            var issueList = [];

            var buildIssueList = function (response) {
                issueList = issueList.concat(_.map(response.data, function (item) {
                    return _.pick(item, 'number', 'updated_at');
                }));
            };

            var writeIssueToDisk = function (issues) {

                var path = require('path'),
                    fs = require('fs'),
                    mkdirp = require('mkdirp'),
                    mypath = path.resolve(config.dest),
                    filename;

                issues.each(function (issue) {

                    try {
                        mkdirp.sync(mypath);
                        fs.accessSync(mypath);
                        filename = path.join(mypath, issue.attr('project') + '-' + issue.attr('number') + '.issue.md');
                        fs.writeFileSync(filename, issue.md());
                        console.log('Writing to disk: ' + path.relative(process.cwd(), filename));
                    } catch (e) {
                        console.log(e);
                    }

                });

            };

            github.listIssues(repo.namespace, repo.id, filters).then(function (response) {

                buildIssueList(response);

                github.fetchNextPage(response.headers, buildIssueList, function () {}, function () {

                    var nextIssue = function () {

                        if (issueList.length) {
                            getIssue(issueList.pop());
                        } else {
                            deferred.resolve();
                        }

                    };

                    var getIssue = function (issueInfo) {
                        var path = require('path'),
                            fs = require('fs'),
                            localissue,
                            localdate,
                            remotedate = new Date(issueInfo.updated_at), // jshint ignore:line
                            mypath = path.resolve(config.dest),
                            filename = path.join(mypath, repo.id + '-' + issueInfo.number + '.issue.md');
                        try {
                            localissue = issuemd(fs.readFileSync(filename, 'utf8'));
                            localdate = new Date(localissue.eq(0).updates().reduce(function (memo, event) {
                                return event.type !== 'reference' ? event : memo;
                            }, localissue.attr('created')));
                        } catch (e) {
                            if (e.code !== 'ENOENT') {
                                console.log(e);
                            }
                        }
                        if (!localissue || localdate < remotedate) {
                            github.fetchIssue(repo.namespace, repo.id, issueInfo.number, filters)
                                .then(function (response) {
                                    writeIssueToDisk(fetchIssueSuccess(response));
                                    nextIssue();
                                });
                        } else {
                            nextIssue();
                        }
                    };

                    nextIssue();

                }, config.answer || 'ask');

            });

            return deferred.promise;

        }

        function limit() {
            return github.rateLimit()
                .then(function (rateLimits) {
                    _.each(rateLimits, function (value, name) {
                        displayStatus(name, value.remaining, value.limit, value.reset);
                    });
                })
                .fail(responseError);
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




        // ******************************************
        // LOGIN
        // ******************************************

        function login(username, password) {

            var deferred = Q.defer();

            // first logout, which ensures userconfig is writable
            github.removeCredentials();

            // if somebody already typed in username and password
            helper.captureCredentials(username, password)
                .then(function (credentials) {

                    var tokenName = github.generateTokenName(credentials.username, HOSTNAME);

                    github.login(credentials.username, credentials.password, tokenName)
                        .then(function (result) {
                            console.log(result);
                            deferred.resolve();
                        })
                        .fail(function (error) {
                            console.log(error);
                        });

                })
                .fail(function () {
                    console.log('Capture credentials error');
                });

            return deferred.promise;

        }


        // ******************************************
        // SEARCH
        // ******************************************

        function locate(config, filters, loadMore) {

            var deferred = Q.defer();

            github.searchRepository(config.params[0], filters)
                .then(function (response) {
                    searchSuccess(response);
                    var g = helper.chalk.green;
                    // display number of results after 1st page
                    console.log('Total results: ' + g(response.data.total_count)); // jshint ignore:line
                    github.fetchNextPage(response.headers, searchSuccess, responseError, null, loadMore || 'ask')
                        .then(deferred.resolve)
                        .fail(deferred.reject);
                })
                .fail(responseError);

            return deferred.promise;

        }

        function search(config, filters, loadMore) {

            var deferred = Q.defer();
            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);

            github.searchIssues(config.params[0], repo, filters)
                .then(function (response) {
                    searchIssuesSuccess(response);
                    var g = helper.chalk.green;
                    // display number of results after 1st page
                    console.log('Total results: ' + g(response.data.total_count)); // jshint ignore:line
                    github.fetchNextPage(response.headers, searchIssuesSuccess, responseError, null, loadMore || 'ask')
                        .then(deferred.resolve)
                        .fail(deferred.reject);
                })
                .fail(responseError);

            return deferred.promise;

        }

        // ******************************************
        // ISSUES
        // ******************************************

        function showIssues(config, command, loadMore) {

            var deferred = Q.defer();

            // unless disabled, assueme autodetect is true
            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);
            var filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

            if (!!repo && config.params.length === 0) {

                github.listIssues(repo.namespace, repo.id, filters)
                    .then(function (response) {
                        listIssuesSuccess(response);
                        github.fetchNextPage(response.headers, listIssuesSuccess, responseError, null, loadMore)
                            .then(deferred.resolve);
                    })
                    .fail(responseError);

            }
            // $ issue github --repo moment/moment search 2805
            else if (!!repo && config.params.length === 1) {

                github.fetchIssue(repo.namespace, repo.id, config.params[0])
                    .then(function (response) {
                        var issues = fetchIssueSuccess(response);
                        // See here for more CLI window size hints: http://stackoverflow.com/a/15854865/665261
                        var templateOptions = _.pick(localConfig, 'dim');
                        console.log(issues.toString(localConfig.width, templates.issuesContentTableLayoutTechnicolor(templateOptions)));
                        deferred.resolve();
                    })
                    .fail(responseError);

            }

            return deferred.promise;

        }

        function showMyIssues(filters, loadMore) {

            var deferred = Q.defer();

            github.listPersonalIssues(filters)
                .then(function (response) {
                    listIssuesSuccess(response);
                    github.fetchNextPage(response.headers, listIssuesSuccess, responseError, null, loadMore)
                        .then(deferred.resolve);
                })
                .fail(responseError);

            return deferred.promise;

        }

        // ******************************************
        // HELPERS
        // ******************************************

        function responseError(error) {
            var errorTitle = helper.chalk.red('*** Error ' + error.error + ' ***');
            console.log(errorTitle);
            console.log(error.message);
        }

        function listIssuesSuccess(response) {

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

        function searchIssuesSuccess(response) {

            var data = response.data.items;
            var issues = issuemd();
            var githubIssues = _.isArray(data) ? data : [data];

            _.each(githubIssues, function (githubIssue) {

                // should we introduce new template for search issues
                // and capture different fields, adjusted to the template?
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

    };

}.call(null);