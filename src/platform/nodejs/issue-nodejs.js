module.exports = (async function () {
  'use strict'

  var _ = require('underscore')

  var issue = require('../../issue-cli.js').init(process.argv)
  var helper = issue.helper
  var config = issue.helper.config
  var defaultAnswer = 'n'

    // TODO: remove this hack
  if (process.argv[2] === 'gh') {
    const result = await issue.run(process.argv)
    return console.log(result.stdout)
  }

  return resultHandler(issue.run(process.argv))

  function resultHandler (result) {
        // if result is string, log it
        // else assume it's a promise and handle it
    if (typeof result === 'string') {
      console.log(result)
    } else {
            // result && result.progress(output).then(output).then(function (result) {
      result && result.then(output).then(function (result) {
        if (result && result.next) {
          if (!config.answer || config.answer === 'ask') {
            helper.promptYesNo('Load next page? ' + (defaultAnswer === 'n' ? '[yN]' : '[nY]'), function () {
              defaultAnswer = 'y'
              resultHandler(result.next())
            }, null, defaultAnswer)
          } else if (!!config.answer && helper.yesno(config.answer)) {
            resultHandler(result.next())
          }
        }
      }).fail(function (error) {
                // {stderr:'Writing config failed'}
                // 'Error: not able write to userconfig - probably need to create config file in home directory:\n\n\tcd ' + (process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME) + '\n\tissue init\n'
        console.error('Error: ' + error.message || error)
      })
    }
  }

  function output (result) {
    _.each(['stdout', 'stderr'], function (item) {
      if (result && _.isArray(result[item])) {
        result[item] = result[item].join('\n')
      }
    })
    result && result.stdout && console.log(result.stdout)
    result && result.stderr && process.stderr.write(result.stderr + '\n')
    return result
  }
})()
