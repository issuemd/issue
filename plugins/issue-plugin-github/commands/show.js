(function () {

    'use strict';

    var _ = require('underscore'),
        Q = require('q');

    module.exports = function (issueConfig, helper, api, issuemd, issueTemplates) {

        var fetchIssue = require('../json-to-issuemd')(issueConfig, helper, api, issuemd);

        return show;

        function show(config) {

            var filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

            // $ issue github --repo moment/moment search
            // $ issue github --repo moment/moment search 2805
            if (!!config.githubrepo && config.params.length === 0) {
                return api.getIssues(config.githubrepo.namespace, config.githubrepo.id, filters)
                    .then(showSuccess);
            } else if (!!config.githubrepo && config.params.length === 1) {
                return api.getIssue(config.githubrepo.namespace, config.githubrepo.id, config.params[0])
                    .then(fetchIssue)
                    .then(showIssueSuccess);
            } else {
                return Q.reject({
                    message: helper.chalk.gray('You must specifiy user/organization and repository name...')
                });
            }

        }

        function showIssueSuccess(issues) {

            var localConfig = issueConfig(),
                templateOptions = _.pick(localConfig, 'dim'),
                templates = issueTemplates(helper.chalk);

            return {
                stdout: issues.toString(localConfig.width, templates.issuesContentTableLayoutTechnicolor(templateOptions))
            };

        }

        function showSuccess(response) {

            var githubIssues = _.isArray(response.data) ? response.data : [response.data],
                pages = api.nextPageUrl(response.headers.link),
                localConfig = issueConfig(),
                templates = issueTemplates(helper.chalk);

            var issues = _.reduce(githubIssues, function (issues, githubIssue) {

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
                stdout: issues.summary(localConfig.width, templates.issuesSummaryTechnicolor(_.pick(localConfig, 'dim'))),
                next: pages.next && function () {
                    return api.nextPage(pages.next.url).then(showSuccess);
                }
            };

        }

    };

})();
