'use strict';

! function () {

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var _ = require('underscore'),
            handleExport = require('./export')(issueConfig, helper, issuemd),
            show = require('./show')(issueConfig, helper, issuemd, issueTemplates),
            limit = require('./limit')(issueConfig, helper, issuemd),
            login = require('./login')(issueConfig, helper, issuemd),
            search = require('./search')(issueConfig, helper, issuemd, issueTemplates),
            locate = require('./locate')(issueConfig, helper, issuemd);

        var github = require('./github.js')(issueConfig, helper, issuemd, issueTemplates);

        var localConfig = issueConfig(),
            filters = _.pick(localConfig, ['in', 'size', 'forks', 'fork', 'created', 'pushed', 'user', 'repo', 'language', 'stars', 'sort', 'order']),
            stderr = [];

        var githubCli = function (config, command) {

            if (localConfig.plugins && localConfig.plugins.github && !localConfig.plugins.github.authToken) {
                stderr.push(helper.chalk.red('notice: ') + helper.chalk.gray('user not logged in, private data is not listed and github api limit is reduced'));
            }

            var commands = {
                limit: limit,
                login: _.partial(login, config),
                logout: github.removeCredentials,
                locate: _.partial(locate, config, filters),
                search: _.partial(search, config, filters),
                show: _.partial(show, config),
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

    };

}.call(null);
