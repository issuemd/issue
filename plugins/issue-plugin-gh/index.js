'use strict'

const API = require('./api')
const autoDetectRepo = require('./auto-detect-repo')
const loginCommand = require('./commands/login')
const logoutCommand = require('./commands/logout')
const limitCommand = require('./commands/limit')
const showCommand = require('./commands/show')
const listCommand = require('./commands/list')
const searchCommand = require('./commands/search')
const locateCommand = require('./commands/locate')
const helptext = require('./helptext')

module.exports = helper => async config => {
  const { issuemd, dateStringToIso, personFromParts, chalk, configGenerator, captureCredentials } = helper
  const { width, command, params, repo, git, plugins: { github }, username: configUsername, password: configPassword } = config

  const api = API(github.authToken, config)

  const githubrepo = await autoDetectRepo(repo, github.autodetect !== false, git && git.remote)

  if (command === 'login') {
    return loginCommand(api, configGenerator, configUsername, configPassword, captureCredentials)
  } else if (command === 'logout') {
    return logoutCommand(configGenerator)
  } else if (command === 'limit') {
    return limitCommand(api, chalk)
  } else if (command === 'search' && params.length) {
    return searchCommand(api, githubrepo.namespace, githubrepo.id, params[0], issuemd, personFromParts, dateStringToIso, width)
  } else if (command === 'show' && params.length) {
    return showCommand(api, githubrepo.namespace, githubrepo.id, params[0], issuemd, dateStringToIso, personFromParts, width)
  } else if (command === 'list' || command === 'show') {
    return listCommand(api, githubrepo.namespace, githubrepo.id, issuemd, personFromParts, dateStringToIso, width)
  } else if (command === 'locate' && params.length) {
    return locateCommand(api, params[0], chalk)
  } else {
    return {
      stdout: helptext
    }
  }
}
