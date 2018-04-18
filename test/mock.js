'use strict'

module.exports = function (ajax, mode, fixturePath) {
  var nock = require('nock')
  var path = require('path')
  var fs = require('fs')
  var crypto = require('crypto')

  nock.enableNetConnect()
  nock.back.fixtures = path.join(path.dirname(fs.realpathSync(__filename)) + '/..', fixturePath || 'test/mocks/')

    // pass in `record` for mode to store api calls, i.e. `npm_config_record=true npm test`
  nock.back.setMode(typeof mode === 'string' ? mode : 'lockdown')

  var cacheJax = ajax

  ajax = function () {
    var myArguments = Array.prototype.slice.call(arguments)
    var promise
    nock.back(crypto.createHash('md5').update(JSON.stringify(myArguments)).digest('hex'), {}, function (nockDone) {
      promise = cacheJax.apply(this, myArguments)
      promise.then(function () {
        nockDone()
      })
    })
    return promise
  }

  return ajax
}
