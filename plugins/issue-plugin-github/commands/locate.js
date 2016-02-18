(function () {

    'use strict';

    module.exports = function (issueConfig, helper, api) {

        var _ = require('underscore');

        return locate;

        function locate(config, filters) {
            return api.searchRepositories(config.params[0], filters).then(locateSuccess);
        }

        function locateSuccess(response) {

            var result = response.data,
                red = helper.chalk.red,
                grey = helper.chalk.grey,
                pages = api.nextPageUrl(response.headers.link);

            var stdout = _.map(result.items, function (repo) {
                return repo.owner.login + grey('/') + red(repo.name) + grey(' \u2606 ' + repo.stargazers_count); // jshint ignore:line
            }).join('\n');

            return {
                stdout: stdout,
                next: pages.next && function () {
                    return api.nextPage(pages.next.url).then(locateSuccess);
                }
            };

        }

    };

})();
