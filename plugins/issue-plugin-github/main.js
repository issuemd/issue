'use strict';

! function () {

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var HOSTNAME = require('os').hostname();

        var _ = require('underscore'),
            Q = require('q');

        var github = require('./github.js')(issueConfig, helper, issuemd);

        var localConfig = issueConfig(),
            templates = issueTemplates(helper.chalk),
            filters = _.pick(localConfig, ['in', 'size', 'forks', 'fork', 'created', 'pushed', 'user', 'repo', 'language', 'stars', 'sort', 'order']),
            stderr = [];

        var githubCli = function (config, command) {

            if (localConfig.plugins && localConfig.plugins.github && !localConfig.plugins.github.authToken) {
                stderr.push(helper.chalk.red('notice: ') + helper.chalk.gray('user not logged in, private data is not listed and github api limit is reduced'));
            }

            var loadMore = config.answer || 'ask';

            var commands = {
                limit: function () {
                    return limit();
                },
                login: function () {
                    return login(config.params[0], config.params[1]);
                },
                logout: github.removeCredentials,
                locate: function () {
                    return locate(config, filters);
                },
                search: function () {
                    return search(config, filters, loadMore);
                },
                show: function () {
                    return show(config, command);
                },
                export: function () {
                    return handleExport(config);
                },
            };
            commands.list = commands.show;

            if (commands[command]) {
                return commands[command]();
            } else {
                return config.help ? githubCli.helptext : [
                    'Unknown command... try:',
                    '',
                    '  issue github --help',
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
                ].join('\n');
            }


        };

        githubCli.helptext = [
            'Locate github repos, search for, list, export and display details for issues...',
            '',
            '  issue github locate <search-term>                      - locate github repo',
            '',
            '  issue github list --repo <user/name>                   - list issues for repo',
            '  issue github search <search-term> --repo <user/name>   - search issues in repo',
            '  issue github show --repo <user/name> <id>              - display specified issue',
            '',
            '  issue github export --repo <user/name> --dest <export-path> --answer <yes-no>',
            '                                                         - display specified issue',
            '',
            '  issue github limit                                     - display api rate limit',
            '',
            '  issue github login                                     - authenticate with github',
            '  issue github logout                                    - remove github credentials',
            '',
            'e.g.',
            '',
            '  issue github locate chancejs',
            '  issue github list --repo victorquinn/chancejs',
            '  issue github search --repo victorquinn/chancejs Ooof',
            '  issue github show --repo victorquinn/chancejs 207',
            '  issue github export --dest issues --answer yes --repo victorquinn/chancejs Ooof',
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

            github.listIssues(repo.namespace, repo.id, filters).then(function (response) {

                buildIssueList(response);

                github.fetchNextPage(response.headers, buildIssueList, function () {}, function () {

                    nextIssue();

                    function nextIssue() {

                        if (issueList.length) {
                            getIssue(issueList.pop());
                        } else {
                            deferred.resolve({
                                stderr: stderr
                            });
                        }

                    }

                    function getIssue(issueInfo) {
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
                                return event.type !== 'reference' ? event.modified : memo; // jshint ignore:line
                            }, localissue.attr('created')));
                        } catch (e) {
                            if (e.code !== 'ENOENT') {
                                deferred.notify(e);
                            }
                        }
                        if (!localissue || localdate < remotedate) {
                            github.fetchIssue(repo.namespace, repo.id, issueInfo.number, filters)
                                .then(function (response) {
                                    writeIssueToDisk(fetchIssueCallback(response));
                                    nextIssue();
                                });
                        } else {
                            nextIssue();
                        }
                    }

                }, config.answer || 'ask');

            });

            return deferred.promise;

            function buildIssueList(response) {
                issueList = issueList.concat(_.map(response.data, function (item) {
                    return _.pick(item, 'number', 'updated_at');
                }));
            }

            function writeIssueToDisk(issues) {

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
                        deferred.notify({
                            stderr: 'Writing to disk: ' + path.relative(process.cwd(), filename)
                        });
                    } catch (e) {
                        stderr.push(e.message);
                    }

                });

            }

        }

        function limit() {

            var w = helper.chalk.white;
            var g = helper.chalk.green;

            return github.rateLimit().then(function (rateLimits) {
                return {
                    stderr: stderr,
                    stdout: _.map(rateLimits, function (value, name) {
                        return w(name + ' requests: ') + colorLimit(value.remaining, value.limit) + w('/' + value.limit + ', resets in: ') + g(getMinutes(value.reset)) + w(' mins');
                    }).join('\n')
                };
            });

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
                    return github.login(credentials.username, credentials.password, github.generateTokenName(credentials.username, HOSTNAME))
                        .then(function (result) {
                            deferred.resolve({
                                stderr: result
                            });
                        }).fail(deferred.reject);
                }).fail(deferred.reject);

            return deferred.promise;

        }


        // ******************************************
        // SEARCH
        // ******************************************

        function locate(config, filters) {
            return github.searchRepository(config.params[0], filters).then(locateSuccess);
        }

        function locateSuccess(response) {

            var result = response.data,
                red = helper.chalk.red,
                grey = helper.chalk.grey,
                pages = github.nextPageUrl(response);

            var stdout = _.map(result.items, function (repo) {
                return repo.owner.login + grey('/') + red(repo.name) + grey(' \u2606 ' + repo.stargazers_count); // jshint ignore:line
            }).join('\n');

            return {
                stderr: stderr,
                stdout: stdout,
                next: pages.next && function () {
                    return github.nextPage(pages.next.url).then(locateSuccess);
                }
            };

        }

        function search(config, filters) {
            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);
            return github.searchIssues(config.params[0], repo, filters).then(searchSuccess);
        }

        function searchSuccess(response) {

            var data = response.data.items,
                issues = issuemd(),
                githubIssues = _.isArray(data) ? data : [data],
                g = helper.chalk.green,
                pages = github.nextPageUrl(response),
                stdout;

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

            stdout = issues.summary(localConfig.width, templates.issuesSummaryTechnicolor(_.pick(localConfig, 'dim')));
            stdout += 'Total results: ' + g(response.data.total_count); // jshint ignore:line

            return {
                stderr: stderr,
                stdout: stdout,
                next: pages.next && function () {
                    return github.nextPage(pages.next.url).then(searchSuccess);
                }
            };

        }

        // ******************************************
        // ISSUES
        // ******************************************

        function show(config) {

            // unless disabled, assueme autodetect is true
            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);
            var filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

            // $ issue github --repo moment/moment search
            // $ issue github --repo moment/moment search 2805
            if (!!repo && config.params.length === 0) {
                return github.listIssues(repo.namespace, repo.id, filters).then(showSuccess);
            } else if (!!repo && config.params.length === 1) {
                return github.fetchIssue(repo.namespace, repo.id, config.params[0]).then(showIssueSuccess);
            }

        }

        function showIssueSuccess(response) {

            var issues = fetchIssueCallback(response),
                templateOptions = _.pick(localConfig, 'dim'),
                pages = github.nextPageUrl(response);

            return {
                stderr: stderr,
                stdout: issues.toString(localConfig.width, templates.issuesContentTableLayoutTechnicolor(templateOptions)),
                next: pages.next && function () {
                    return github.nextPage(pages.next.url).then(showSuccess);
                }
            };

        }

        function showSuccess(response) {

            var data = response.data;
            var issues = issuemd();
            var githubIssues = _.isArray(data) ? data : [data];
            var pages = github.nextPageUrl(response);

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

            return {
                stderr: stderr,
                stdout: issues.summary(localConfig.width, templates.issuesSummaryTechnicolor(_.pick(localConfig, 'dim'))),
                next: pages.next && function () {
                    return github.nextPage(pages.next.url).then(showSuccess);
                }
            };

        }

        function fetchIssueCallback(githubIssue) {

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
