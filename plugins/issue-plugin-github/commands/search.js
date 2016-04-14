(function () {

    'use strict';

    var _ = require('underscore');

    module.exports = function (helper, api) {

        return function (config, filters) {
            return api.searchIssues(config.params[0], config.githubrepo, filters).then(searchSuccess);
        };

        function searchSuccess(response) {

            var data = response.data.items,
                issues = helper.issuemd(),
                githubIssues = _.isArray(data) ? data : [data],
                pages = api.nextPageUrl(response.headers.link),
                // TODO: not sure if this stdout is making it into output
                stdout;

            _.each(githubIssues, function (githubIssue) {

                var issue = helper.issuemd({})
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

            stdout = issues.summary(helper.config.width);
            stdout += helper.info('Total results', response.data.total_count); // jshint ignore:line

            return {
                stdout: stdout,
                next: pages.next && function () {
                    return api.nextPage(pages.next.url).then(searchSuccess);
                }
            };

        }

    };

})();
