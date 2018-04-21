const _ = require('lodash')

const locate = (result, { red, grey }) => {
  return _.map(result.items, (repo) => {
    return repo.owner.login + grey('/') + red(repo.name) + grey(' \u2606 ' + repo.stargazers_count)
  }).join('\n')
}

module.exports = locate
