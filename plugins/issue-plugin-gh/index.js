'use strict'

const { fetchAll, fetchOne } = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const list = require('./commands/list')
const limit = require('./commands/limit')
const helptext = require('./helptext')

module.exports = ({ issuemd, dateStringToIso, personFromParts, chalk }) => async config => {
  const { width, command, params, repo, git, plugins: { github } } = config

  // pages = api.nextPageUrl(response.headers.link)
  // next: pages.next && function () {
  //   return api.nextPage(pages.next.url).then(showSuccess)
  // }
  const apiFetchOneWithAuth = url => fetchOne(url, github.authToken)
  const apiFetchAllWithAuth = url => fetchAll(url, github.authToken)

  const githubrepo = autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

  if (command === 'limit') {
    const { out: { resources } } = await apiFetchAllWithAuth(`/rate_limit`)
    const limits = await limit(resources, chalk)

    return { stdout: limits }
  } else if (command === 'show' && params.length) {
    const { out: issue } = await apiFetchAllWithAuth(`/repos/${githubrepo.namespace}/${githubrepo.id}/issues/${params[0]}`)
    issue.events = (await apiFetchAllWithAuth(issue.events_url)).out
    issue.comments = (await apiFetchAllWithAuth(issue.comments_url)).out
    const pullRequests = issue.pull_request ? (await apiFetchAllWithAuth(issue.pull_request.url)).out : null

    return { stdout: issueFromApiJson(show(issue, pullRequests), issuemd, dateStringToIso, personFromParts).toString(width) }
  } else if (command === 'show' || command === 'list') {
    // TODO: add filters
    // TODO: add confirmation dialog
    // const response = await apiFetchOneWithAuth(`/repos/${githubrepo.namespace}/${githubrepo.id}/issues`)
    const response = await apiFetchAllWithAuth(`/repos/${githubrepo.namespace}/${githubrepo.id}/issues`)
    // console.log(response.allHeaders)
    return { stdout: list(response.out, issuemd, personFromParts, dateStringToIso).summary(width) }
  } else {
    return { stdout: helptext }
  }
}
