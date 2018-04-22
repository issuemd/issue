const listHandler = require('../list-handler.js')

const search = (api, namespace, repoId, q, issuemd, personFromParts, dateStringToIso, width) => {
  // TODO: add confirmation dialog
  return api.search(q, namespace, repoId, (json, next) => ({
    stdout: listHandler(json.items, issuemd, personFromParts, dateStringToIso).summary(width),
    next
  }))
}

module.exports = search
