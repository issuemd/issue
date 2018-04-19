'use strict'

const { fetchAll } = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const list = require('./commands/list')
const limit = require('./commands/limit')
const helptext = require('./helptext')

module.exports = ({ issuemd, dateStringToIso, personFromParts, chalk }) => async config => {
  const { width, command, params, repo, git, plugins: { github } } = config

  const apiFetchWithAuth = url => fetchAll(`${url}?access_token=${github.authToken}`)

  const githubrepo = autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

  if (command === 'limit') {
    const { resources } = await apiFetchWithAuth(`https://api.github.com/rate_limit`)
    const limits = await limit(resources, chalk)

    return { stdout: limits }
  } else if (command === 'show' && params.length) {
    const issue = await apiFetchWithAuth(`https://api.github.com/repos/${githubrepo.namespace}/${githubrepo.id}/issues/${params[0]}`)
    issue.events = await apiFetchWithAuth(issue.events_url)
    issue.comments = await apiFetchWithAuth(issue.comments_url)
    const pullRequests = issue.pull_request ? await apiFetchWithAuth(issue.pull_request.url) : null

    return { stdout: issueFromApiJson(show(issue, pullRequests), issuemd, dateStringToIso, personFromParts).toString(width) }
  } else if (command === 'show' || command === 'list') {
    const response = await apiFetchWithAuth(`https://api.github.com/repos/${githubrepo.namespace}/${githubrepo.id}/issues`)
    return list(response, issuemd, personFromParts, dateStringToIso, width)
    // const issue = await show(githubrepo.namespace, githubrepo.id, params[0], apiFetchWithAuth)
    // return issueFromApiJson(issue, issuemd, dateStringToIso, personFromParts).toString(width)
    // return 'should do list'
  } else {
    return { stdout: helptext }
  }
}
