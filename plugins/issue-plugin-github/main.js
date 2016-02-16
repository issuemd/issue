'use strict';

! function() {

    module.exports = function(issueConfig, helper, issuemd, issueTemplates) {

        var hostname = require('os').hostname();

        var _ = require('underscore'),
            Q = require('q');

        var github = require('./github.js')(issueConfig, helper, issuemd);

        var localConfig = issueConfig(),
            templates = issueTemplates(helper.chalk),
            filters = _.pick(localConfig, ['in', 'size', 'forks', 'fork', 'created', 'pushed', 'user', 'repo', 'language', 'stars', 'sort', 'order']),
            stderr = [];

        var githubCli = function(config, command) {

            if (localConfig.plugins && localConfig.plugins.github && !localConfig.plugins.github.authToken) {
                stderr.push(helper.chalk.red('notice: ') + helper.chalk.gray('user not logged in, private data is not listed and github api limit is reduced'));
            }

            var loadMore = config.answer || 'ask';

            var commands = {
                limit: limit,
                login: _.partial(login, config.params[0], config.params[1]),
                logout: github.removeCredentials,
                locate: _.partial(locate, config, filters),
                search: _.partial(search, config, filters, loadMore),
                show: _.partial(show, config, command),
                export: _.partial(handleExport, config)
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
        // EXPORT
        // ******************************************

        function handleExport(config) {

            var deferred = Q.defer();

            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);

            var filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

            var issueList = [];

            return github.listIssues(repo.namespace, repo.id, filters)
                .then(github.pages)
                .then(function(response) {

                    issueList = issueList.concat(_.map(response, function(item) {
                        return _.pick(item, 'number', 'updated_at');
                    }));

                    var stale = [];

                    _.each(issueList, function(issueInfo) {

                        var path = require('path'),
                            fs = require('fs'),
                            localissue,
                            localdate,
                            remotedate = new Date(issueInfo.updated_at), // jshint ignore:line
                            mypath = path.resolve(config.dest),
                            filename = path.join(mypath, repo.id + '-' + issueInfo.number + '.issue.md');
                        try {
                            localissue = issuemd(fs.readFileSync(filename, 'utf8'));
                            localdate = new Date(localissue.eq(0).updates().reduce(function(memo, event) {
                                return event.type !== 'reference' ? event.modified : memo; // jshint ignore:line
                            }, localissue.attr('created')));
                        } catch (e) {
                            if (e.code !== 'ENOENT') {
                                deferred.notify(e);
                            }
                        }
                        if (!localissue || localdate < remotedate) {
                            stale.push(issueInfo.number);
                        }

                    });

                    // TODO: make this more in line with promises way of doing things
                    return limitEach(stale, config.throttle, function(issueId, cb) {
                        github.fetchIssue(repo.namespace, repo.id, issueId, filters)
                            .then(function(response) {
                                writeIssueToDisk(issueFromApiJson(response));
                                cb();
                            });
                    });

                });

            // http://stackoverflow.com/a/35422593/665261
            function limitEach(arr, max, fn) {

                var counter = 0,
                    index = 0,
                    limitDeferred = Q.defer();

                runMore();

                function runMore() {
                    // default to 10 concurrent connections
                    while (counter < (max || 10) && index < arr.length) {
                        ++counter;
                        fn(arr[index++], handler);
                    }
                    if (counter === 0 && index === arr.length) {
                        limitDeferred.resolve();
                    }
                }

                function handler(err) {
                    --counter;
                    if (err) {
                        limitDeferred.reject(err);
                    } else {
                        runMore();
                    }
                }

                return limitDeferred.promise;

            }

            function writeIssueToDisk(issues) {

                var path = require('path'),
                    fs = require('fs'),
                    mkdirp = require('mkdirp'),
                    mypath = path.resolve(config.dest),
                    filename;

                issues.each(function(issue) {

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

        // ******************************************
        // LIMIT
        // ******************************************

        function limit() {

            var w = helper.chalk.white;
            var g = helper.chalk.green;

            return github.rateLimit().then(function(rateLimits) {
                return {
                    stderr: stderr,
                    stdout: _.map(rateLimits, function(value, name) {
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

            // first logout, which ensures userconfig is writable
            return github.removeCredentials().then(function() {
                // if somebody already typed in username and password
                return helper.captureCredentials(username, password);
            }).then(function(credentials) {
                return github.login(credentials.username, credentials.password, github.generateTokenName(credentials.username, hostname));
            }).then(function(result) {
                return {
                    stderr: result
                };
            });

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

            var stdout = _.map(result.items, function(repo) {
                return repo.owner.login + grey('/') + red(repo.name) + grey(' \u2606 ' + repo.stargazers_count); // jshint ignore:line
            }).join('\n');

            return {
                stderr: stderr,
                stdout: stdout,
                next: pages.next && function() {
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

            _.each(githubIssues, function(githubIssue) {

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
                next: pages.next && function() {
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
            } else {
                return Q.reject({
                    message: helper.chalk.gray('You must specifiy user/organization and repository name...')
                });
            }

        }

        function showIssueSuccess(response) {

            var issues = issueFromApiJson(response),
                templateOptions = _.pick(localConfig, 'dim'),
                pages = github.nextPageUrl(response);

            return {
                stderr: stderr,
                stdout: issues.toString(localConfig.width, templates.issuesContentTableLayoutTechnicolor(templateOptions)),
                next: pages.next && function() {
                    return github.nextPage(pages.next.url).then(showSuccess);
                }
            };

        }

        function showSuccess(response) {

            var githubIssues = _.isArray(response.data) ? response.data : [response.data];
            var pages = github.nextPageUrl(response);

            var issues = _.reduce(githubIssues, function(issues, githubIssue) {

                return issues.merge(issuemd({
                    title: githubIssue.title,
                    creator: helper.personFromParts({
                        username: githubIssue.user.login
                    }),
                    created: helper.dateStringToIso(githubIssue.created_at), // jshint ignore:line
                    body: githubIssue.body,
                    id: githubIssue.number,
                    assignee: githubIssue.assignee ? githubIssue.assignee.login : 'unassigned',
                    status: githubIssue.state || ''
                }));

            }, issuemd());

            return {
                stderr: stderr,
                stdout: issues.summary(localConfig.width, templates.issuesSummaryTechnicolor(_.pick(localConfig, 'dim'))),
                next: pages.next && function() {
                    return github.nextPage(pages.next.url).then(showSuccess);
                }
            };

        }

        // ******************************************
        // GITHUB API TO ISSUEMD CONVERTER
        // ******************************************

        function issueFromApiJson(githubIssue) {

            // create issuemd instance
            var issue = issuemd({
                title: githubIssue.title,
                creator: helper.personFromParts({ username: githubIssue.user.login }),
                created: helper.dateStringToIso(githubIssue.created_at), // jshint ignore:line
                body: githubIssue.body,
            });

            var attr = {};

            // http://regexper.com/#/([^/]+?)(?:\/issues\/.+)$/
            var repoName = githubIssue.url.match(/([^/]+?)(?:\/issues\/.+)$/)[1];
            if (repoName) {
                attr.project = repoName;
            }

            var attributes = {
                status: function() {
                    return githubIssue.state;
                },
                number: function() {
                    return githubIssue.number;
                },
                locked: function() {
                    return githubIssue.locked;
                },
                assignee: function() {
                    return githubIssue.assignee && githubIssue.assignee.login;
                },
                updated: function() {
                    return helper.dateStringToIso(githubIssue.updated_at); // jshint ignore:line
                },
                pull_request_url: function() { // jshint ignore:line
                    return githubIssue.pull_request && githubIssue.pull_request.url; // jshint ignore:line
                },
                milestone: function() {
                    return githubIssue.milestone && githubIssue.milestone.title;
                },
                closed: function() {
                    return githubIssue.closed && helper.dateStringToIso(githubIssue.closed_at); // jshint ignore:line
                },
                labels: function() {
                    // labels get concatenated to comma delimited string
                    return githubIssue.labels.length > 0 && githubIssue.labels.map(function(label) {
                        return label.name;
                    }).join(', ');
                }
            };

            // add attributes
            issue.attr(_.reduce(attributes, function(memo, next, key) {
                var value = next();
                if (value) { memo[key] = value; }
                return memo;
            }, attr));

            // handle comments
            _.each(githubIssue.comments, function(comment) {
                issue.update({
                    body: comment.body,
                    modifier: comment.user.login,
                    modified: helper.dateStringToIso(comment.updated_at), // jshint ignore:line
                    type: 'comment'
                });
            });

            // handle events
            _.each(githubIssue.events, function(evt) {

                var issueNo = githubIssue.number;
                var update = {
                    body: undefined,
                    modifier: evt.actor.login,
                    modified: helper.dateStringToIso(evt.created_at), // jshint ignore:line
                    type: 'event'
                };

                var handlers = {
                    closed: function() {
                        return 'status: closed';
                    },
                    reopened: function() {
                        return 'status: reopened'; /* evt.actor.login */
                    },
                    merged: function() {
                        return 'status: merged'; /* evt.actor.login */
                    },
                    locked: function() {
                        return 'locking: locked'; /* evt.actor.login */
                    },
                    unlocked: function() {
                        return 'locking: unlocked'; /* evt.actor.login */
                    },
                    subscribed: function(evt) {
                        return 'subscribed: ' + evt.actor.login;
                    },
                    mentioned: function(evt) {
                        return 'mentioned: ' + evt.actor.login;
                    },
                    assigned: function(evt) {
                        return 'assigned: ' + evt.assignee.login;
                    },
                    unassigned: function(evt) {
                        return 'unassigned: ' + evt.assignee.login;
                    },
                    labeled: function(evt) {
                        return 'added label: ' + evt.label.name; /* evt.label.color */
                    },
                    unlabeled: function(evt) {
                        return 'removed label: ' + evt.label.name; /* evt.label.color */
                    },
                    milestoned: function(evt) {
                        return 'added milestone: ' + evt.milestone.title;
                    },
                    demilestoned: function(evt) {
                        return 'removed milestone: ' + evt.milestone.title;
                    },
                    renamed: function(evt) {
                        return 'renamed issue: ' + evt.rename.to; /* evt.rename.from */
                    },
                    head_ref_deleted: function() { // jshint ignore:line
                        return 'branch: deleted';
                    },
                    head_ref_restored: function() { // jshint ignore:line
                        return 'branch: restored';
                    },
                    referenced: function() {
                        update.type = 'reference';
                        return 'The issue was referenced from a commit message';
                    },
                    // synthesised events
                    pull_request: function() { // jshint ignore:line
                        update.type = 'pull-request';
                        return 'pull request opened';
                    },
                    update: function() { // jshint ignore:line
                        update.type = 'edit';
                        return 'update to issue';
                    }
                };

                if (!!handlers[evt.event]) {
                    update.body = handlers[evt.event](evt);
                }

                issue.filter('number', issueNo + '')
                    .update(update);

            });

            // sort comments and events
            issue.sortUpdates();

            return issue;

        }

    };

}.call(null);
