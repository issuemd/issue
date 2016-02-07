'use strict';

! function () {

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var HOSTNAME = require('os').hostname();

        var _ = require('underscore'),
            Q = require('q');

        var github = require('./github.js')(issueConfig, helper, issuemd);

        var localConfig = issueConfig(),
            templates = issueTemplates(helper.chalk),
            filters = _.pick(localConfig, ['in', 'size', 'forks', 'fork', 'created', 'pushed', 'user', 'repo', 'language', 'stars']);

        var githubCli = function (config, command) {

            var deferred = Q.defer();

            var loadMore = config.answer || 'ask';

            switch (command) {

                case 'limit':
                    limit()
                        .then(deferred.resolve);
                    break;

                case 'login':
                    login(config.params[0], config.params[1])
                        .then(deferred.resolve);
                    break;

                case 'logout':
                    github.removeCredentials();
                    deferred.resolve();
                    break;

                case 'search':
                    // if --repo or -r specified, we're searching for a repository
                    if(!!config.repo || !!config.r){
                        search(config.repo || config.r, filters, loadMore)
                            .then(deferred.resolve);
                    }
                    // if --issues or --i specified, we're searching for issues
                    else if(!!config.issues || !!config.i){
                        searchIssues(config.issues || config.i, config.sort, config.order, loadMore)
                            .then(deferred.resolve);
                    }else{
                        console.log([
                            'Unknown search type parameter',
                            '',
                            'You can set --r or --repo paremeters for respository search, or --i or --issues parameters for issues search',
                            '',
                            'Example:',
                            '',
                            '  issue github search --r chancejs',
                            ''
                        ].join('\n'));
                    }
                    break;

                case 'list':
                case 'show':
                    showIssues(config, command, loadMore)
                        .then(deferred.resolve);
                    break;

                case 'mine':
                    showMyIssues(filters, loadMore)
                        .then(deferred.resolve);
                    break;

                default:
                    console.log([
                        'Unknown command',
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

        function search(repository, filters, answer) {

            var deferred = Q.defer();

            if (localConfig.plugins && localConfig.plugins.github && !localConfig.plugins.github.authToken) {
                var g = helper.chalk.gray;
                console.log(g('Warning, user not logged in, private repositories are not listed...'));
            }

            github.searchRepository(repository, filters)
                .then(function (response) {
                    searchSuccess(response);
                    github.fetchNextPage(response.headers, searchSuccess, responseError, null, answer || 'ask')
                        .then(deferred.resolve);
                })
                .fail(responseError);

            return deferred.promise;

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

        }


        function searchIssues (searchTerm, sort, order, loadMore) {
           var deferred = Q.defer();
            if (localConfig.plugins && localConfig.plugins.github && !localConfig.plugins.github.authToken) {
                var g = helper.chalk.gray;
                console.log(g('Warning, user not logged in, private issues are not listed...'));
            }

            github.searchIssues(searchTerm, sort, order)
                .then(function (response) {
                    searchIssuesSuccess(response);
                    var g = helper.chalk.green;
                    // display number of results after 1st page
                    console.log('Total results: ' + g(response.data.total_count));
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
