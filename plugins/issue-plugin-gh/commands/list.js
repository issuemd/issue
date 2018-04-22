const listHandler = require('../list-handler.js')

const list = (api, namespace, repoId, issuemd, personFromParts, dateStringToIso, width) => {
  // TODO: add confirmation dialog
  return api.list(namespace, repoId, (json, next) => ({
    stdout: listHandler(json, issuemd, personFromParts, dateStringToIso).summary(width),
    next
  }))
}

module.exports = list
