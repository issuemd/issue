(function () {

    'use strict';

    var _ = require('underscore');

    module.exports = function (helper, api) {

        return function (response) {

            var Q = require('q');

            var requests = [
                api.nextPage(response.data.events_url).then(api.pages), // jshint ignore:line
                api.nextPage(response.data.comments_url).then(api.pages), // jshint ignore:line
            ].concat(response.data.pull_request ? api.nextPage(response.data.pull_request.url) : []); // jshint ignore:line

            return Q.all(requests).spread(function (events, comments, pullRequests) {

                if (pullRequests && pullRequests.data.updated_at) { // jshint ignore:line

                    events.push({
                        event: 'pull_request',
                        actor: {
                            login: pullRequests.data.user.login
                        },
                        created_at: pullRequests.data.updated_at // jshint ignore:line
                    });

                } else {

                    var lastCommentOrEventUpdate = events.reduce(function (memo, item) {
                        return item.event !== 'referenced' && new Date(item.created_at) > new Date(memo) ? item.created_at : memo; // jshint ignore:line
                    }, comments.length && comments[comments.length - 1].updated_at); // jshint ignore:line

                    var calculatedUpdateTime;

                    if (!lastCommentOrEventUpdate && response.data.created_at !== response.data.updated_at) { // jshint ignore:line
                        calculatedUpdateTime = response.data.updated_at; // jshint ignore:line
                    } else if (!!lastCommentOrEventUpdate && new Date(response.data.updated_at) > new Date(lastCommentOrEventUpdate)) { // jshint ignore:line
                        calculatedUpdateTime = response.data.updated_at; // jshint ignore:line
                    }

                    if (!!calculatedUpdateTime) { // jshint ignore:line
                        var newevent = {
                            event: 'update',
                            actor: {
                                login: response.data.user.login
                            },
                            created_at: calculatedUpdateTime // jshint ignore:line
                        };
                        events.push(newevent);
                    }

                }

                var issue = response.data;
                issue.events = events;
                issue.comments = comments;

                return issueFromApiJson(helper, issue);

            });

        };
    };


    function issueFromApiJson(helper, githubIssue) {

        // create issuemd instance
        var issue = helper.issuemd({
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
                closed: helper.events.closed,
                reopened: helper.events.reopened,
                merged: helper.events.merged,
                locked: helper.events.locked,
                unlocked: helper.events.unlocked,
                subscribed: function (evt) {
                    return helper.events.subscribed(evt.actor.login);
                },
                mentioned: function (evt) {
                    return helper.events.mentioned(evt.actor.login);
                },
                assigned: function (evt) {
                    return helper.events.assigned(evt.assignee.login);
                },
                unassigned: function (evt) {
                    return helper.events.unassigned(evt.assignee.login);
                },
                labeled: function (evt) { /* evt.label.color */
                    return helper.events.labeled(evt.label.name);
                },
                unlabeled: function (evt) { /* evt.label.color */
                    return helper.events.unlabeled(evt.label.name);
                },
                milestoned: function (evt) {
                    return helper.events.milestoned(evt.milestone.title);
                },
                demilestoned: function (evt) {
                    return helper.events.demilestoned(evt.milestone.title);
                },
                renamed: function (evt) { /* evt.rename.from */
                    return helper.events.renamed(evt.rename.to);
                },
                head_ref_deleted: helper.events.branchDeleted, // jshint ignore:line
                head_ref_restored: helper.events.branchRestored, // jshint ignore:line
                referenced: function () {
                    update.type = 'reference';
                    return helper.events.referenced;
                },
                // synthesised events
                pull_request: function () { // jshint ignore:line
                    update.type = 'pull-request';
                    return helper.events.pullRequest();
                },
                update: function () { // jshint ignore:line
                    update.type = 'edit';
                    return helper.events.update();
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

    }

}());
