'use strict'

void (function () {
  module.exports = function (helper) {
    var path = require('path')
    var fs = require('fs')

    var _ = require('underscore')

    var config = helper.config
    var pluginDirs = [
      path.join(__dirname, '..', 'plugins'),
      path.join(__dirname, '..', '..')
    ].concat(config['plugin-dir'] ? [config['plugin-dir']] : []).map(function (pluginDir) {
      return path.resolve(pluginDir) + path.sep
    })

    var plugins = {
      init: require('./issue-init.js')(helper)
    }

    _.each(pluginDirs, function (pluginDir) {
      if (helper.fileExists(pluginDir) && fs.lstatSync(pluginDir).isDirectory()) {
                // enable all plugins by default
        _.each(fs.readdirSync(pluginDir), function (projectName) {
          var value,
            packageJson

          if (/^issue-plugin-.+/.test(projectName)) {
            value = projectName.match(/^issue-plugin-(.+)/)[1]
            config.plugins = config.plugins || {}

            if (fs.lstatSync(pluginDir + projectName).isDirectory()) {
              config.plugins[value] = config.plugins[value] || {}

              if (typeof config.plugins[value].enabled === 'undefined') {
                config.plugins[value].enabled = true
              }

              if (config.plugins[value].enabled) {
                packageJson = require(pluginDir + projectName + path.sep + 'package.json')
                plugins[value] = require(pluginDir + projectName + path.sep + packageJson.main)(helper)
              } else {
                plugins[value] = false
              }
            }
          }
        })
      }
    })

    return plugins
  }
}())
