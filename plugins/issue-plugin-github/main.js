'use strict';

! function () {

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var hostname = require('os').hostname();

        var _ = require('underscore'),
            handleExport = require('./export')(issueConfig, helper, issuemd),
            show = require('./show')(issueConfig, helper, issuemd, issueTemplates);

        var github = require('./github.js')(issueConfig, helper, issuemd, issueTemplates);

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
                limit: limit,
                login: _.partial(login, config.params[0], config.params[1]),
                logout: github.removeCredentials,
                locate: _.partial(locate, config, filters),
                search: _.partial(search, config, filters, loadMore),
                show: _.partial(show, config, command),
                export: _.partial(handleExport, config, issuemd, helper)
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

            // first logout, which ensures userconfig is writable
            return github.removeCredentials().then(function () {
                // if somebody already typed in username and password
                return helper.captureCredentials(username, password);
            }).then(function (credentials) {
                return github.login(credentials.username, credentials.password, github.generateTokenName(credentials.username, hostname));
            }).then(function (result) {
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

    };

}.call(null);
