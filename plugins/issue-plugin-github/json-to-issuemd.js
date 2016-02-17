(function () {

    'use strict';

    var _ = require('underscore');

    module.exports = function (issuemd, helper, githubIssue) {

        // create issuemd instance
        var issue = issuemd({
            title: githubIssue.title,
            creator: helper.personFromParts({
                username: githubIssue.user.login
            }),
            created: helper.dateStringToIso(githubIssue.created_at), // jshint ignore:line
            body: githubIssue.body,
        });

        var attr = {};

        // http://regexper.com/#/([^/]+?)(?:\/issues\/.+)$/
        var repoName = githubIssue.url.match(/([^/]+?)(?:\/issues\/.+)$/)[1];
        if (repoName) {
            attr.project = repoName;
        }

        var attributes = {
            status: function () {
                return githubIssue.state;
            },
            number: function () {
                return githubIssue.number;
            },
            locked: function () {
                return githubIssue.locked;
            },
            assignee: function () {
                return githubIssue.assignee && githubIssue.assignee.login;
            },
            updated: function () {
                return helper.dateStringToIso(githubIssue.updated_at); // jshint ignore:line
            },
            pull_request_url: function () { // jshint ignore:line
                return githubIssue.pull_request && githubIssue.pull_request.url; // jshint ignore:line
            },
            milestone: function () {
                return githubIssue.milestone && githubIssue.milestone.title;
            },
            closed: function () {
                return githubIssue.closed && helper.dateStringToIso(githubIssue.closed_at); // jshint ignore:line
            },
            labels: function () {
                // labels get concatenated to comma delimited string
                return _.pluck(githubIssue.labels, 'name').join(', ');
            }
        };

        // add attributes
        issue.attr(_.reduce(attributes, function (memo, next, key) {
            var value = next();
            if (value) {
                memo[key] = value;
            }
            return memo;
        }, attr));

        // handle comments
        _.each(githubIssue.comments, function (comment) {
            issue.update({
                body: comment.body,
                modifier: comment.user.login,
                modified: helper.dateStringToIso(comment.updated_at), // jshint ignore:line
                type: 'comment'
            });
        });

        // handle events
        _.each(githubIssue.events, function (evt) {

            var issueNo = githubIssue.number;
            var update = {
                body: undefined,
                modifier: evt.actor.login,
                modified: helper.dateStringToIso(evt.created_at), // jshint ignore:line
                type: 'event'
            };

            var handlers = {
                closed: function () {
                    return 'status: closed';
                },
                reopened: function () {
                    return 'status: reopened'; /* evt.actor.login */
                },
                merged: function () {
                    return 'status: merged'; /* evt.actor.login */
                },
                locked: function () {
                    return 'locking: locked'; /* evt.actor.login */
                },
                unlocked: function () {
                    return 'locking: unlocked'; /* evt.actor.login */
                },
                subscribed: function (evt) {
                    return 'subscribed: ' + evt.actor.login;
                },
                mentioned: function (evt) {
                    return 'mentioned: ' + evt.actor.login;
                },
                assigned: function (evt) {
                    return 'assigned: ' + evt.assignee.login;
                },
                unassigned: function (evt) {
                    return 'unassigned: ' + evt.assignee.login;
                },
                labeled: function (evt) {
                    return 'added label: ' + evt.label.name; /* evt.label.color */
                },
                unlabeled: function (evt) {
                    return 'removed label: ' + evt.label.name; /* evt.label.color */
                },
                milestoned: function (evt) {
                    return 'added milestone: ' + evt.milestone.title;
                },
                demilestoned: function (evt) {
                    return 'removed milestone: ' + evt.milestone.title;
                },
                renamed: function (evt) {
                    return 'renamed issue: ' + evt.rename.to; /* evt.rename.from */
                },
                head_ref_deleted: function () { // jshint ignore:line
                    return 'branch: deleted';
                },
                head_ref_restored: function () { // jshint ignore:line
                    return 'branch: restored';
                },
                referenced: function () {
                    update.type = 'reference';
                    return 'The issue was referenced from a commit message';
                },
                // synthesised events
                pull_request: function () { // jshint ignore:line
                    update.type = 'pull-request';
                    return 'pull request opened';
                },
                update: function () { // jshint ignore:line
                    update.type = 'edit';
                    return 'update to issue';
                }
            };

            if (!!handlers[evt.event]) {
                update.body = handlers[evt.event](evt);
            }

            issue.filter('number', issueNo + '')
                .update(update);

        });

        // sort comments and events
        issue.sortUpdates();

        return issue;

    };

}());
