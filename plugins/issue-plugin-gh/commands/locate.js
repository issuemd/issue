const _ = require('lodash')

const locateHandler = (result, { red, grey }) => {
  return _.map(result.items, (repo) => {
    return repo.owner.login + grey('/') + red(repo.name) + grey(' \u2606 ' + repo.stargazers_count)
  }).join('\n')
}

const locate = (api, q, chalk) => {
  return api.locate(q, (json, next) => ({
    stdout: locateHandler(json, chalk),
    next
  }))
}

module.exports = locate
