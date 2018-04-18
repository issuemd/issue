(function () {
  'use strict'

  module.exports = function (helper) {
    var Q = require('q')

    return function () {
      try {
        helper.configGenerator('plugins.github.authToken', '', true)
        helper.configGenerator('plugins.github.authTokenId', '', true)
        return Q.resolve()
      } catch (e) {
        return Q.reject(e)
      }
    }
  }
})()
