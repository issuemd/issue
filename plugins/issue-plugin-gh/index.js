'use strict'

const { fetchAll, fetchOne } = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const list = require('./commands/list')
const limit = require('./commands/limit')
const helptext = require('./helptext')

const reform = (uri, token) => `${/^https?:\/\//.test(uri) ? '' : 'https://api.github.com'}${uri}${token ? `?access_token=${token}` : ''}`


module.exports = ({ issuemd, dateStringToIso, personFromParts, chalk }) => async config => {
  const { width, command, params, repo, git, plugins: { github } } = config

  // pages = api.nextPageUrl(response.headers.link)
  // next: pages.next && function () {
  //   return api.nextPage(pages.next.url).then(showSuccess)
  // }
  const apiFetchOneWithAuth = (url, progressCallback) => fetchOne(reform(url, github.authToken), progressCallback)
  const apiFetchAllWithAuth = (url, progressCallback) => fetchAll(reform(url, github.authToken), progressCallback)

  const githubrepo = autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

  const limitCommand = async () => {
    const { json } = await apiFetchOneWithAuth('/rate_limit')
    const limits = await limit(json.resources, chalk)

    return { stdout: limits }
  }

  const showCommand = async () => {
    const { json: issue } = await apiFetchAllWithAuth(`/repos/${githubrepo.namespace}/${githubrepo.id}/issues/${params[0]}`)
    issue.events = (await apiFetchAllWithAuth(issue.events_url)).json
    issue.comments = (await apiFetchAllWithAuth(issue.comments_url)).json
    const pullRequests = issue.pull_request ? (await apiFetchAllWithAuth(issue.pull_request.url)).json : null

    return { stdout: issueFromApiJson(show(issue, pullRequests), issuemd, dateStringToIso, personFromParts).toString(width) }
  }

  const recursiveListCommand = url => async () => {
    const { json, nextPageUrl } = await fetchOne(reform(url))
    const next = nextPageUrl.next && recursiveListCommand(nextPageUrl.next.url)
    return {
      stdout: list(json, issuemd, personFromParts, dateStringToIso).summary(width),
      next
    }
  }

  const listCommand = () => {
    // TODO: add filters
    // TODO: add confirmation dialog
    return recursiveListCommand(`/repos/${githubrepo.namespace}/${githubrepo.id}/issues`)()
  }

  if (command === 'limit') {
    return limitCommand()
  } else if (command === 'show' && params.length) {
    return showCommand()
  } else if (command === 'show' || command === 'list') {
    return listCommand()
  } else {
    return { stdout: helptext }
  }
}
