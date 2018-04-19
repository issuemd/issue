const _ = require('lodash')

const limit = async (namespace, reponame, apiFetchWithAuth, chalk) => {
  const { white, green, red, yellow } = chalk

  const { resources: rateLimits } = await apiFetchWithAuth(`https://api.github.com/rate_limit`)

  const colorLimit = (value, limit) => {
    const currentState = value / limit
    const color = currentState < 0.33 ? red : currentState < 0.66 ? yellow : green
    return color(value)
  }

  const getMinutes = (date) => {
    return Math.ceil((date * 1000 - new Date()) / 1000 / 60)
  }

  return _.map(rateLimits, function (value, name) {
    return `${white(name + ' requests: ')}${colorLimit(value.remaining, value.limit)}${white('/' + value.limit + ', resets in: ')}${green(getMinutes(value.reset))}${white(' mins')}`
  }).join('\n')
}

module.exports = limit
