'use strict'

const url = require('url')
const querystring = require('querystring')
const os = require('os')

const { fetchAll, fetchOne } = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const list = require('./commands/list')
const limit = require('./commands/limit')
const auth = require('./commands/auth')
const locate = require('./commands/locate')
const helptext = require('./helptext')

const reform = (uri, token) => {
  const { pathname, query } = url.parse(uri)
  const parsedQuery = querystring.parse(query)
  if (token) {
    parsedQuery.access_token = token
  }
  const suffix = Object.keys(parsedQuery).length ? '?' + querystring.stringify(parsedQuery) : ''
  return `https://api.github.com${pathname}${suffix}`
}

module.exports = ({ issuemd, dateStringToIso, personFromParts, chalk, configGenerator, captureCredentials, toBase64 }) => async config => {
  const { width, command, params, repo, git, plugins: { github } } = config

  const apiFetchOneWithAuth = (uri, headers, method, postData, progressCallback) => fetchOne(reform(uri, github.authToken), headers, method, postData, progressCallback)
  const apiFetchAllWithAuth = (uri, headers, method, postData, progressCallback) => fetchAll(reform(uri, github.authToken), headers, method, postData, progressCallback)

  const githubrepo = await autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

  const limitCommand = async () => {
    const { json } = await apiFetchOneWithAuth('/rate_limit')
    const limits = await limit(json.resources, chalk)

    return { stdout: limits }
  }

  const loginCommand = async () => {
    const generateTokenName = (username, hostname) => `issuemd/issue-${username}@${hostname}`

    const doLogin = async (username, password, tokenName) => {
      const basicAuthHeader = { Authorization: 'Basic ' + toBase64(username + ':' + password) }
      const { json: tokens } = await apiFetchOneWithAuth('/authorizations', basicAuthHeader)
      const token = tokens.filter(auth => auth.note === tokenName)[0]
      const tokenId = token && token.id
      // TODO: handle error in revoke
      // const revoked = !tokenId ? {} : await apiFetchOneWithAuth(`/authorizations/${tokenId}`, basicAuthHeader, 'DELETE')
      await apiFetchOneWithAuth(`/authorizations/${tokenId}`, basicAuthHeader, 'DELETE')

      const postData = {
        scopes: ['user', 'repo', 'gist'],
        note: tokenName
      }

      const { json: newToken } = await apiFetchOneWithAuth('/authorizations', basicAuthHeader, 'POST', postData)
      const err = auth(configGenerator, newToken.token, newToken.id)
      if (!err) {
        return 'Logged in'
      } else {
        return 'Problem logging in!'
      }
    }

    // first logout, which ensures userconfig is writable
    const err = await auth(configGenerator)
    if (!err) {
      const { username, password } = await captureCredentials(config.username, config.password)
      const hostname = os.hostname()
      return { stdout: await doLogin(username, password, generateTokenName(username, hostname)) }
    } else {
      return { stdout: 'Problem logging out!' }
    }
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

  if (command === 'logout') {
    // TODO: attempt to revoke token remotely
    const err = await auth(configGenerator)
    const stdout = err ? 'Error logging out' : 'Logged out from issue github'
    return { stdout }
  } else if (command === 'login') {
    return loginCommand()
  } else if (command === 'limit') {
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
