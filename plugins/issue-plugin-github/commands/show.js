(function () {

    'use strict';

    var _ = require('underscore'),
        Q = require('q');

    module.exports = function (helper, api) {

        var fetchIssue = require('../json-to-issuemd')(helper, api);

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
                    message: helper.notice('You must specifiy user/organization and repository name...')
                });
            }

        }

        function showIssueSuccess(issues) {

            return {
                stdout: issues.toString(helper.config.width)
            };

        }

        function showSuccess(response) {

            var githubIssues = _.isArray(response.data) ? response.data : [response.data],
                pages = api.nextPageUrl(response.headers.link);

            var issues = _.reduce(githubIssues, function (issues, githubIssue) {

                return issues.merge(helper.issuemd({
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

            }, helper.issuemd());

            return {
                stdout: issues.summary(helper.config.width),
                next: pages.next && function () {
                    return api.nextPage(pages.next.url).then(showSuccess);
                }
            };

        }

    };

})();
