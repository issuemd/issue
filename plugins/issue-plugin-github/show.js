(function () {

    'use strict';

    var _ = require('underscore'),
        Q = require('q');

    module.exports = function (issueConfig, helper, issuemd, issueTemplates) {

        var issueFromApiJson = _.partial(require('./json-to-issuemd'), issuemd, helper);
        var github = require('./github.js')(issueConfig, helper, issuemd);

        return show;

        function show(config) {

            // unless disabled, assueme autodetect is true
            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);
            var filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

            // $ issue github --repo moment/moment search
            // $ issue github --repo moment/moment search 2805
            if (!!repo && config.params.length === 0) {
                return github.listIssues(repo.namespace, repo.id, filters).then(showSuccess);
            } else if (!!repo && config.params.length === 1) {
                return github.fetchIssue(repo.namespace, repo.id, config.params[0]).then(showIssueSuccess);
            } else {
                return Q.reject({
                    message: helper.chalk.gray('You must specifiy user/organization and repository name...')
                });
            }

        }

        function showIssueSuccess(response) {

            var issues = issueFromApiJson(response),
                localConfig = issueConfig(),
                templateOptions = _.pick(localConfig, 'dim'),
                pages = github.nextPageUrl(response),
                templates = issueTemplates(helper.chalk);

            return {
                stdout: issues.toString(localConfig.width, templates.issuesContentTableLayoutTechnicolor(templateOptions)),
                next: pages.next && function () {
                    return github.nextPage(pages.next.url).then(showSuccess);
                }
            };

        }

        function showSuccess(response) {

            var githubIssues = _.isArray(response.data) ? response.data : [response.data],
                pages = github.nextPageUrl(response),
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
                    return github.nextPage(pages.next.url).then(showSuccess);
                }
            };

        }

    };

})();
