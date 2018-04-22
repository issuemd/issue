const _ = require('lodash')

const getMinutes = (date) => {
  return Math.ceil((date * 1000 - new Date()) / 1000 / 60)
}

const colorLimit = (value, limit, { red, yellow, green }) => {
  const currentState = value / limit
  const color = currentState < 0.33 ? red : currentState < 0.66 ? yellow : green
  return color(value)
}

const limitHandler = (rateLimits, { white, green, red, yellow }) => _.map(rateLimits, (value, name) => ([
  white(`${name} requests: `),
  colorLimit(value.remaining, value.limit, { red, yellow, green }),
  white(`/${value.limit}, resets in: `),
  green(getMinutes(value.reset)),
  white(' mins')
].join(''))).join('\n')

const limit = async (api, chalk) => {
  const { json } = await api.rateLimit()
  const limits = await limitHandler(json.resources, chalk)

  return {
    stdout: limits
  }
}

module.exports = limit
