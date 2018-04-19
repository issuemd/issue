const _ = require('lodash')

const getMinutes = (date) => {
  return Math.ceil((date * 1000 - new Date()) / 1000 / 60)
}

const colorLimit = (value, limit, { red, yellow, green }) => {
  const currentState = value / limit
  const color = currentState < 0.33 ? red : currentState < 0.66 ? yellow : green
  return color(value)
}

const limit = (rateLimits, { white, green, red, yellow }) => _.map(rateLimits, (value, name) => ([
  white(`${name} requests: `),
  colorLimit(value.remaining, value.limit, { red, yellow, green }),
  white(`/${value.limit}, resets in: `),
  green(getMinutes(value.reset)),
  white(' mins')
].join(''))).join('\n')

module.exports = limit
