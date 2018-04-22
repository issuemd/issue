const _ = require('lodash')

const listHandler = (response, issuemd, personFromParts, dateStringToIso) => {
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

const list = (api, namespace, repoId, issuemd, personFromParts, dateStringToIso, width) => {
  // TODO: add filters
  // TODO: add confirmation dialog
  return api.list(namespace, repoId, (json, next) => ({
    stdout: listHandler(json, issuemd, personFromParts, dateStringToIso).summary(width),
    next
  }))
}

module.exports = list
