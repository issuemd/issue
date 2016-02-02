'use strict';

module.exports = function () {

    var _ = require('underscore');

    var paths = {};
    var slash = '/';
    if (process.platform === 'win32') {
        slash = '\\';
        paths.w = 'C:\\SOME\\USER\\HOME';
    }
    paths.r = 'test' + slash + 'test-environment';
    paths.a = paths.r + slash + 'a';
    paths.b = paths.a + slash + 'b';
    paths.c = paths.b + slash + 'c';
    paths.d = paths.c + slash + 'd';

    var filenames = {};
    filenames.r = '.issuerc';
    filenames.b = paths.b + slash + filenames.r;
    filenames.c = paths.c + slash + filenames.r;

    var configs = {};
    configs.git = 'git@github.com:issuemd/issue.git';
    configs.args = ['some', 'arguments', 'another', 'argument'];
    configs.init = {
        technicolor: true
    };
    configs.opts1 = {
        option1: true
    };
    configs.opts2 = {
        option2: {
            part1: true,
            part2: false
        }
    };
    configs.opts3 = {
        option3: true
    };
    configs.opts4 = {
        option4: 'string value'
    };
    configs.optsAll = _.extend({}, configs.opts1, configs.opts2, configs.opts3, configs.opts4);
    configs.inputArgs = [
        '--option1', 'true',
        'some',
        'arguments',
        '--option2.part1', 'on',
        '--option2.part2', 'off',
        'another',
        'argument',
        '--option3',
        '--option4', 'string value'
    ];
    configs.outputString = [
        'option1=true',
        'option2.part1=true',
        'option2.part2=false',
        'option3=true',
        'option4=string value',
        'params[0]=some',
        'params[1]=arguments',
        'params[2]=another',
        'params[3]=argument',
        'technicolor=true'
    ].join('\n');

    var fixtureObjects = {};
    fixtureObjects.configFileArray = [paths.d, paths.c, paths.b, paths.a, paths.r];
    if (process.platform === 'win32') {
        fixtureObjects.configFileArray.push(paths.w);
    }
    fixtureObjects.configFileArrayLimited = [filenames.c, filenames.b];
    fixtureObjects.updatedConfig = {
        persisted: {
            butAppendedTo: 'option',
            additional: {
                from: 'object'
            }
        },
        deeply: {
            nested: 'option',
            augmented: 'by json'
        },
        projects: {
            my_awesome_project: { // jshint ignore:line
                url: 'http://my.awesome-project.com/api',
                type: 'esoteric_system',
                default_user: 'jojo.the.clown' // jshint ignore:line
            }
        }
    };
    fixtureObjects.cliArguments = _.extend({}, {
        params: configs.args
    }, {
        options: configs.optsAll
    });
    fixtureObjects.cliOptions = _.extend({}, configs.optsAll);
    fixtureObjects.cliOptionsRemovedOption3 = _.extend({}, configs.opts1, configs.opts2, configs.opts4);
    fixtureObjects.cliOptionsRemovedOption2Part1 = _.extend({}, configs.opts1, {
        option2: {
            part2: false
        }
    }, configs.opts4);
    fixtureObjects.cliOptionsLayered = _.extend({}, {
        git: {
            projectPath: paths.c
        }
    }, configs.optsAll, {
        params: configs.args
    }, configs.init);
    fixtureObjects.cliOptionsLayeredGitRemote = _.extend({}, {
        git: {
            projectPath: paths.a,
            remote: configs.git
        }
    }, configs.optsAll, {
        params: configs.args
    }, {
        technicolor: false
    });
    fixtureObjects.secondConfig = configs.init;
    fixtureObjects.firstConfig = _.extend({}, configs.init, {
        technicolor: false
    });
    fixtureObjects.configAfterWrite = _.extend({}, configs.init, configs.opts1, configs.opts2, {
        option1: false
    });
    fixtureObjects.issuercArray = [filenames.r];
    fixtureObjects.issuercArrayAll = [filenames.c, filenames.b, filenames.r];
    fixtureObjects.nestedIssuercArray = [filenames.c];
    fixtureObjects.emptyStringArray = [''];
    fixtureObjects.emptyPathsArray = [''];
    if (process.platform === 'win32') {
        fixtureObjects.emptyPathsArray.push(paths.w);
    }
    fixtureObjects.argv = ['node', '/Users/somebody/projects/issue/bin/issue'].concat(configs.inputArgs);
    fixtureObjects.configArray = [fixtureObjects.secondConfig, fixtureObjects.firstConfig];

    var fixtures = _.mapObject(fixtureObjects, function (item) {
        return JSON.stringify(item);
    });
    fixtures.cliOptionsLayeredList = 'git.projectPath=' + paths.c + '\n' + configs.outputString,
        fixtures.gitConfig = [
            '[core]',
            '        repositoryformatversion = 0',
            '        filemode = true',
            '        bare = false',
            '        logallrefupdates = true',
            '        ignorecase = true',
            '        precomposeunicode = true'
        ].join('\n');
    fixtures.gitConfigWithRemote = [
        fixtures.gitConfig,
        '[remote "origin"]',
        '        url = ' + configs.git,
        '        fetch = +refs/heads/*:refs/remotes/origin/*'
    ].join('\n');
    fixtures.secondConfigList = 'technicolor=true';

    return fixtures;

}();