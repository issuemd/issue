const _ = require('lodash')

const list = (response, issuemd, personFromParts, dateStringToIso) => {
  const githubIssues = _.isArray(response) ? response : [response]

  const issues = _.reduce(githubIssues, (issues, githubIssue) => {
    return issues.merge(issuemd({
      title: githubIssue.title,
      creator: personFromParts({
        username: githubIssue.user.login
      }),
      created: dateStringToIso(githubIssue.created_at),
      body: githubIssue.body,
      id: githubIssue.number,
      assignee: githubIssue.assignee ? githubIssue.assignee.login : 'unassigned',
      status: githubIssue.state || ''
    }))
  }, issuemd())

  return issues
}

module.exports = list
