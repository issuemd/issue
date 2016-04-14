'use strict';

! function () {

    var writeFileSync = require('fs').writeFileSync,
        utils = require('./issue-utils');

    module.exports = function () {

        return function () {

            if (utils.fileExists('.issuerc')) {
                console.log('Can not init issuemd here, there is already a `.issuerc` file present in this directory - sorry :-/');
                return;
            }

            var newConfig = {};
            utils.promptYesNo('Do you like colours in your console? [Yn]', function () {
                newConfig.technicolor = true;
                cb();
            }, function () {
                newConfig.technicolor = false;
                cb();
            }, 'y');

            function cb() {

                console.log('Config to be written to `./issuerc`:');
                console.log('');
                console.log(JSON.stringify(newConfig, null, 4).replace(/^/gm, '    '));
                console.log('');
                utils.promptYesNo('Should I go ahead and write the config now? [Yn]', function () {
                    writeFileSync('.issuerc', JSON.stringify(newConfig, null, 4));
                }, 'Config creation aborted - phew, that was close!', 'y');

            }

        };

    };

}.call(null);
