(function () {

    'use strict';

    module.exports = function (helper, api) {

        var _ = require('underscore');

        return locate;

        function locate(config, filters) {
            return api.searchRepositories(config.params[0], filters).then(locateSuccess);
        }

        function locateSuccess(response) {

            var result = response.data,
                pages = api.nextPageUrl(response.headers.link);

            var stdout = _.map(result.items, function (repo) {
                return helper.repolistitem(repo.owner.login, repo.name, repo.stargazers_count); // jshint ignore:line
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
