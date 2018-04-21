'use strict'

const url = require('url')
const querystring = require('querystring')

const { fetchAll, fetchOne } = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const list = require('./commands/list')
const limit = require('./commands/limit')
const locate = require('./commands/locate')
const helptext = require('./helptext')

const reform = (uri, token) => {
  const { pathname, query } = url.parse(uri)
  const parsedQuery = querystring.parse(query)
  if (token) {
    parsedQuery.access_token = token
  }
  const suffix = Object.keys(parsedQuery).length ? '?' + querystring.stringify(parsedQuery) : ''
  return `https://api.github.com${pathname}?${querystring.stringify(parsedQuery)}`
}


module.exports = ({ issuemd, dateStringToIso, personFromParts, chalk }) => async config => {
  const { width, command, params, repo, git, plugins: { github } } = config

  const apiFetchOneWithAuth = (uri, progressCallback) => fetchOne(reform(uri, github.authToken), progressCallback)
  const apiFetchAllWithAuth = (uri, progressCallback) => fetchAll(reform(uri, github.authToken), progressCallback)

  const githubrepo = autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

  const limitCommand = async () => {
    const { json } = await apiFetchOneWithAuth('/rate_limit')
    const limits = await limit(json.resources, chalk)

    return { stdout: limits }
  }

  const recursiveLocateCommand = uri => async () => {
    const { json, nextPageUrl } = await apiFetchOneWithAuth(uri)
    const next = nextPageUrl.next && recursiveLocateCommand(nextPageUrl.next.url)
    return {
      stdout: locate(json, chalk),
      next
    }
  }

  const locateCommand = q => {
    return recursiveLocateCommand(`/search/repositories?q=${q}`)()
  }

  const showCommand = async issueId => {
    const { json: issue } = await apiFetchAllWithAuth(`/repos/${githubrepo.namespace}/${githubrepo.id}/issues/${issueId}`)
    issue.events = (await apiFetchAllWithAuth(issue.events_url)).json
    issue.comments = (await apiFetchAllWithAuth(issue.comments_url)).json
    const pullRequests = issue.pull_request ? (await apiFetchAllWithAuth(issue.pull_request.url)).json : null

    return { stdout: issueFromApiJson(show(issue, pullRequests), issuemd, dateStringToIso, personFromParts).toString(width) }
  }

  const recursiveListCommand = uri => async () => {
    const { json, nextPageUrl } = await apiFetchOneWithAuth(uri)
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
    return showCommand(params[0])
  } else if (command === 'show' || command === 'list') {
    return listCommand()
  } else if (command === 'locate' && params.length) {
    return locateCommand(params[0])
  } else {
    return { stdout: helptext }
  }
}
