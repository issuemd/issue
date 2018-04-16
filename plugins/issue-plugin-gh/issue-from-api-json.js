const _ = require('lodash')

const issueFromApiJson = (githubIssue, issuemd, dateStringToIso, personFromParts) => {

    // create issuemd instance
    const issue = issuemd({
        title: githubIssue.title,
        creator: personFromParts({ username: githubIssue.user.login }),
        created: dateStringToIso(githubIssue.created_at),
        body: githubIssue.body,
    });

    const attr = {};

    // http://regexper.com/#/([^/]+?)(?:\/issues\/.+)$/
    const repoName = githubIssue.url.match(/([^/]+?)(?:\/issues\/.+)$/)[1];
    if (repoName) {
        attr.project = repoName;
    }

    const attributes = {
        status: () => githubIssue.state,
        number: () => githubIssue.number,
        locked: () => githubIssue.locked,
        assignee: () => githubIssue.assignee && githubIssue.assignee.login,
        updated: () => dateStringToIso(githubIssue.updated_at),
        pull_request_url: () => githubIssue.pull_request && githubIssue.pull_request.url,
        milestone: () => githubIssue.milestone && githubIssue.milestone.title,
        closed: () => githubIssue.closed && dateStringToIso(githubIssue.closed_at),
        // labels get concatenated to comma delimited string
        labels: () => _.pluck(githubIssue.labels, 'name').join(', ')
    };

    // add attributes
    issue.attr(_.reduce(attributes, function (memo, next, key) {
        const value = next();
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
            modified: dateStringToIso(comment.updated_at),
            type: 'comment'
        });
    });

    // handle events
    _.each(githubIssue.events, function (evt) {

        const issueNo = githubIssue.number;
        const update = {
            body: undefined,
            modifier: evt.actor.login,
            modified: dateStringToIso(evt.created_at),
            type: 'event'
        };

        const handlers = {
            closed: () => 'status: closed',
            reopened: () => 'status: reopened',
            merged: () => 'status: merged',
            locked: () =>  'locking: locked',
            unlocked: () => 'locking: unlocked',
            subscribed: evt => 'subscribed: ' + evt.actor.login,
            mentioned: evt => 'mentioned: ' + evt.actor.login,
            assigned: evt => 'assigned: ' + evt.assignee.login,
            unassigned: evt => 'unassigned: ' + evt.assignee.login,
            labeled: evt => 'added label: ' + evt.label.name,
            unlabeled: evt => 'removed label: ' + evt.label.name,
            milestoned: evt => 'added milestone: ' + evt.milestone.title,
            demilestoned: evt => 'removed milestone: ' + evt.milestone.title,
            renamed: evt => 'renamed issue: ' + evt.rename.to,
            head_ref_deleted: () => 'branch: deleted',
            head_ref_restored: () => 'branch: restored',
            referenced: () => {
                update.type = 'reference';
                return 'The issue was referenced from a commit message';
            },
            // synthesised events
            pull_request: () => {
                update.type = 'pull-request';
                return 'pull request opened';
            },
            update: () => {
                update.type = 'edit';
                return 'update to issue';
            }
        };

        if (!!handlers[evt.event]) {
            update.body = handlers[evt.event](evt);
        }

        issue.filter('number', issueNo + '').update(update);
    });

    // sort comments and events
    issue.sortUpdates();

    return issue;
}

module.exports = issueFromApiJson