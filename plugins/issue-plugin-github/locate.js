(function () {

    'use strict';

    module.exports = function (issueConfig, helper, issuemd) {

        var _ = require('underscore'),
            github = require('./github.js')(issueConfig, helper, issuemd);

        return locate;

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
                stdout: stdout,
                next: pages.next && function () {
                    return github.nextPage(pages.next.url).then(locateSuccess);
                }
            };

        }

    };

})();
