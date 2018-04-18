'use strict'

module.exports = (function () {
  var fixtures = require('./fixtures.js')

    // temporarily load mocked argv over process.argv for loading config
  var cacheProcessAgrv = process.argv
  var cacheEnvTesting = process.env.TESTING
  if (process.platform === 'win32') {
    process.env.USERPROFILE = JSON.parse(fixtures.configFileArray).slice(-1)[0]
  }
  process.argv = JSON.parse(fixtures.argv)
  process.env.TESTING = true

  var issue = require('../src/issue-cli.js').init(process.argv)
  delete issue.helper.config.width
  process.argv = cacheProcessAgrv
  process.env.TESTING = cacheEnvTesting

  var pluginHelper = {
    issueHelper: issueHelperFactory(mockConfig),
    issueHelperFactory: issueHelperFactory,
    mockConfig: mockConfig,
    issuemd: require('issuemd')
  }

  return pluginHelper

  function mockConfig () {
    return {}
  }

  function issueHelperFactory () {
    var issueHelperProxy = issue.helper
    issueHelperProxy.ajax = require('./mock.js')(issueHelperProxy.ajax, process.env.npm_config_record ? 'record' : 'lockdown') // jshint ignore:line
    return issueHelperProxy
  }
})()
