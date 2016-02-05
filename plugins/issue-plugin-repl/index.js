'use strict';

! function () {

    module.exports = function (issueConfig) { // helper, issuemd, issueTemplates

        var config = issueConfig();

        return function () {

            var repl = require('repl'),
                spawnSync = require('child_process').spawnSync,
                path = require('path'),
                fs = require('fs'),
                bin = path.join(path.dirname(fs.realpathSync(__filename)), '..', '..', 'bin', 'issue'),
                command = config.set || '';

            function evaluate(cmd, context, filename, callback) {
                spawnSync(bin, [command, cmd].join(' ').trim().split(/\s+/), {
                    stdio: 'inherit'
                });
                callback(null, '');
            }

            repl.start({
                prompt: ['#issue', command].join(' ').trim() + ' ',
                input: process.stdin,
                output: process.stdout,
                // avoid returning quoted string with newlines escaped
                writer: function (input) {
                    return input;
                },
                eval: evaluate
            }).on('reset', function () {
                command = '';
                repl.repl._initialPrompt = '#issue ';
            }).on('exit', function () {
                process.exit();
            });

            repl.repl.commands.clear.help = 'Clear the context of current commands (set with .set)';

            delete repl.repl.commands.load;
            delete repl.repl.commands.save;

            repl.repl.commands.set = {
                help: 'Set context for subsequent commands (clear with .clear)',
                action: function (currentCommand) {
                    command = currentCommand;
                    repl.repl._initialPrompt = ['#issue', command].join(' ').trim() + ' ';
                    repl.repl.displayPrompt();
                }
            };

        };

    };

}.call(null);