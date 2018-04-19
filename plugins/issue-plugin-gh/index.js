'use strict'

const { fetchAll } = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const limit = require('./commands/limit')
const helptext = require('./helptext')

module.exports = ({ issuemd, dateStringToIso, personFromParts, chalk }) => async config => {
  const { width, command, params, repo, git, plugins: { github } } = config

  const apiFetchWithAuth = url => fetchAll(`${url}?access_token=${github.authToken}`)

  const githubrepo = autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

  if (command === 'limit') {
    const limits = await limit(githubrepo.namespace, githubrepo.id, apiFetchWithAuth, chalk)
    return limits
    // return issueFromApiJson(issue, issuemd, dateStringToIso, personFromParts).toString(width)
  } else if (command === 'show' && params.length) {
    const issue = await show(githubrepo.namespace, githubrepo.id, params[0], apiFetchWithAuth)
    return issueFromApiJson(issue, issuemd, dateStringToIso, personFromParts).toString(width)
  } else {
    return helptext
  }
}
