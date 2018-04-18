'use strict'

void (function () {
  module.exports = function (helper) {
    return function () {
      var repl = require('repl')
      var spawnSync = require('child_process').spawnSync
      var path = require('path')
      var bin = path.join(__dirname, '..', '..', 'bin', 'issue')
      var command = helper.config.set || ''
      var prompt = function (command) {
        return [
          helper.chalk.bold.red('#') + helper.chalk.bold.white('issue'),
          command
        ].join(' ').trim() + ' '
      }

      function evaluate (cmd, context, filename, callback) {
        spawnSync(bin, [command, cmd].join(' ').trim().split(/\s+/), {
          stdio: 'inherit'
        })
        callback(null, '')
      }

      repl.start({
        prompt: prompt(command),
        input: process.stdin,
        output: process.stdout,
                // avoid returning quoted string with newlines escaped
        writer: function (input) {
          return input
        },
        eval: evaluate
      }).on('reset', function () {
        command = ''
        repl.repl._initialPrompt = '#issue '
      }).on('exit', function () {
        process.exit()
      })

      repl.repl.commands.clear.help = 'Clear the context of current commands (set with .set)'

      delete repl.repl.commands.load
      delete repl.repl.commands.save

      repl.repl.commands.set = {
        help: 'Set context for subsequent commands (clear with .clear)',
        action: function (currentCommand) {
          command = currentCommand
          repl.repl._initialPrompt = prompt(command)
          repl.repl.displayPrompt()
        }
      }
    }
  }
}())
