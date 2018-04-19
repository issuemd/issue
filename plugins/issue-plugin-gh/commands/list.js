const _ = require('lodash')

const list = (response, issuemd, personFromParts, dateStringToIso, width) => {
  const githubIssues = _.isArray(response) ? response : [response]
        // pages = api.nextPageUrl(response.headers.link)

  const issues = _.reduce(githubIssues, (issues, githubIssue) => {
    return issues.merge(issuemd({
      title: githubIssue.title,
      creator: personFromParts({
        username: githubIssue.user.login
      }),
      created: dateStringToIso(githubIssue.created_at), // jshint ignore:line
      body: githubIssue.body,
      id: githubIssue.number,
      assignee: githubIssue.assignee ? githubIssue.assignee.login : 'unassigned',
      status: githubIssue.state || ''
    }))
  }, issuemd())

  return {
    stdout: issues.summary(width)
        // next: pages.next && function () {
        //   return api.nextPage(pages.next.url).then(showSuccess)
        // }
  }
}

module.exports = list
