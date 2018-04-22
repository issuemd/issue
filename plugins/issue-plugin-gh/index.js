'use strict'

const os = require('os')

const API = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const issueFromApiJson = require('./issue-from-api-json')
const show = require('./commands/show')
const list = require('./commands/list')
const limit = require('./commands/limit')
const auth = require('./commands/auth')
const locate = require('./commands/locate')
const helptext = require('./helptext')

module.exports = ({ issuemd, dateStringToIso, personFromParts, chalk, configGenerator, captureCredentials }) => async config => {
  const { width, command, params, repo, git, plugins: { github }, username: configUsername, password: configPassword } = config

  const api = API(github.authToken)

  const githubrepo = await autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

  const limitCommand = async () => {
    const { json } = await api.rateLimit()
    const limits = await limit(json.resources, chalk)

    return {
      stdout: limits
    }
  }

  const loginCommand = async () => {
    // first logout, which ensures userconfig is writable
    // TODO: better error handling, i.e. throw
    const err = await auth(configGenerator)
    if (!err) {
      const { username, password } = await captureCredentials(configUsername, configPassword)
      const hostname = os.hostname()
      const tokenName = `issuemd/issue-${username}@${hostname}`

      const { json: tokens } = await api.authorizations(username, password)
      const token = tokens.filter(auth => auth.note === tokenName)[0]
      const tokenId = token && token.id

      // TODO: handle error in revoke
      // const revoked = !tokenId ? {} : await api.revokeAuthorization(username, password, tokenId)
      await api.revokeAuthorization(username, password, tokenId)

      const { json: newToken } = await api.createAuthorizationToken(username, password, tokenName)

      const err = auth(configGenerator, newToken.token, newToken.id)
      if (!err) {
        return {
          stdout: 'Logged in'
        }
      } else {
        return {
          stdout: 'Problem logging in!'
        }
      }
    } else {
      return {
        stdout: 'Problem logging out!'
      }
    }
  }

  const locateCommand = q => {
    return api.locate(q, (json, next) => ({
      stdout: locate(json, chalk),
      next
    }))
  }

  const showCommand = async issueId => {
    const { json: issue } = await api.show(githubrepo.namespace, githubrepo.id, issueId)

    const { json: events } = await api.fetchAll(issue.events_url)
    issue.events = events

    const { json: comments } = await api.fetchAll(issue.comments_url)
    issue.comments = comments

    let pullRequests
    if (issue.pull_request) {
      const { json } = await api.fetchAll(issue.pull_request.url)
      pullRequests = json
    }

    return {
      stdout: issueFromApiJson(show(issue, pullRequests), issuemd, dateStringToIso, personFromParts).toString(width)
    }
  }

  const listCommand = () => {
    // TODO: add filters
    // TODO: add confirmation dialog
    return api.list(githubrepo.namespace, githubrepo.id, (json, next) => ({
      stdout: list(json, issuemd, personFromParts, dateStringToIso).summary(width),
      next
    }))
  }

  if (command === 'logout') {
    // TODO: attempt to revoke token remotely
    const err = await auth(configGenerator)
    return {
      stdout: err ? 'Error logging out' : 'Logged out from issue github'
    }
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
    return {
      stdout: helptext
    }
  }
}
