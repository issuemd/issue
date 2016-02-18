(function () {

    'use strict';

    var _ = require('underscore');

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var github = require('../github.js')(issueConfig, helper, issuemd);

        return search;

        function search(config, filters) {
            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);
            return github.searchIssues(config.params[0], repo, filters).then(searchSuccess);
        }

        function searchSuccess(response) {

            var data = response.data.items,
                issues = issuemd(),
                githubIssues = _.isArray(data) ? data : [data],
                g = helper.chalk.green,
                pages = github.nextPageUrl(response.headers.link),
                templates = issueTemplates(helper.chalk),
                localConfig = issueConfig(),
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
                stdout: stdout,
                next: pages.next && function () {
                    return github.nextPage(pages.next.url).then(searchSuccess);
                }
            };

        }

    };

})();
