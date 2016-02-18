'use strict';

! function () {

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var _ = require('underscore');

        var localConfig = issueConfig(),
            stderr = [];

        // TODO: why do we have localConfig and also pass config?
        var githubCli = function (config, command) {

            var api = require('./api.js')(config, helper);

            // unless disabled, assueme autodetect is true
            var githubrepo = autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote),
                filters = _.pick(localConfig, ['in', 'size', 'forks', 'fork', 'created', 'pushed', 'user', 'repo', 'language', 'stars', 'sort', 'order']);

            if (githubrepo) {
                config.githubrepo = githubrepo;
            }

            if (localConfig.plugins && localConfig.plugins.github && !localConfig.plugins.github.authToken) {
                stderr.push(helper.chalk.red('notice: ') + helper.chalk.gray('user not logged in, private data is not listed and github api limit is reduced'));
            }

            // alias the `list` command to `show`
            if (command === 'list') {
                command = 'show';
            }

            try {
                // try to require the module, passing initialisation methods, then run with config and filters
                return require('./commands/' + command)(issueConfig, helper, api, issuemd, issueTemplates)(config, filters);
            } catch (e) {
                if (e.code === 'MODULE_NOT_FOUND') {
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
                } else {
                    console.error(e);
                }
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

}.call(null);
