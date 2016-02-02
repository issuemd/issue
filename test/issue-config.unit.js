'use strict';

describe('issue config', function () {

    var fs = require('fs'),
        fixtures = require('./fixtures.js');

    // temporarily load mocked argv over process.argv for loading config
    var cacheProcessAgrv = process.argv,
        cacheEnvTesting = process.env.TESTING;
    if (process.platform === 'win32') {
        process.env.USERPROFILE = JSON.parse(fixtures.configFileArray).slice(-1)[0];
    }
    process.argv = JSON.parse(fixtures.argv);
    process.env.TESTING = true;
    var config = require('../src/issue-config.js').init(process.argv);
    process.argv = cacheProcessAgrv;
    process.env.TESTING = cacheEnvTesting;

    beforeEach(function () {

        config.setPersistedPathBase('test/test-environment/a/b/c/d', 'test/test-environment');

        var myconf = config();

        delete myconf.width;

    });

    it('should load as function', function () {

        expect(typeof config).toBe('function');

    });

    it('should generate array of paths to check', function () {

        expect(JSON.stringify(config.getPaths())).toBe(fixtures.configFileArray);

    });

    it('should generate array of single empty path for current directory', function () {

        config.setPersistedPathBase('.', '.');
        expect(JSON.stringify(config.getPaths())).toBe(fixtures.emptyPathsArray);

        config.setPersistedPathBase('.', './');
        expect(JSON.stringify(config.getPaths())).toBe(fixtures.emptyPathsArray);

        config.setPersistedPathBase('./', '.');
        expect(JSON.stringify(config.getPaths())).toBe(fixtures.emptyPathsArray);

        config.setPersistedPathBase('./', './');
        expect(JSON.stringify(config.getPaths())).toBe(fixtures.emptyPathsArray);

        config.setPersistedPathBase(process.cwd(), './');
        expect(JSON.stringify(config.getPaths())).toBe(fixtures.emptyPathsArray);

        config.setPersistedPathBase(process.cwd(), process.cwd());
        expect(JSON.stringify(config.getPaths(process.cwd(), process.cwd()))).toBe(fixtures.emptyPathsArray);

        config.setPersistedPathBase('./', process.cwd());
        expect(JSON.stringify(config.getPaths())).toBe(fixtures.emptyPathsArray);

    });

    it('should generate array of paths containing `.issuerc` config files', function () {
        // assumes there is an `.issuerc` file in `./`, `./test/test-environment/a/b` and `./test/test-environment/a/b/c`
        config.setPersistedPathBase('./test/test-environment/a/b/c/d', 'test/test-environment');
        expect(JSON.stringify(config.getConfigFiles())).toBe(fixtures.configFileArrayLimited);

        config.setPersistedPathBase('./', './');
        expect(JSON.stringify(config.getConfigFiles())).toBe(fixtures.issuercArray);

        config.setPersistedPathBase('test/test-environment/a/b/c', 'test/test-environment/a/b/c');
        expect(JSON.stringify(config.getConfigFiles())).toBe(fixtures.nestedIssuercArray);

    });

    it('should default the base to the current working directory if not passed', function () {

        // assumes there is an `.issuerc` file in `./`, `./test/test-environment/a/b` and `./test/test-environment/a/b/c`
        config.setPersistedPathBase('.');
        expect(JSON.stringify(config.getPaths().slice(0, 1))).toBe(fixtures.emptyStringArray);

        config.setPersistedPathBase('./');
        expect(JSON.stringify(config.getConfigFiles().slice(0, 1))).toBe(fixtures.issuercArray);

        config.setPersistedPathBase('test/test-environment/a/b/c');
        expect(JSON.stringify(config.getConfigFiles().slice(0, 3))).toBe(fixtures.issuercArrayAll);
        config.setPersistedPathBase('test/test-environment/a/b/c', '.');
        expect(JSON.stringify(config.getConfigFiles())).toBe(fixtures.issuercArrayAll);

    });

    it('should generate array of json configurations from file list', function () {

        // assumes there is an `.issuerc` file in `./test/test-environment/a/b` and `./test/test-environment/a/b/c`
        expect(JSON.stringify(config.getJSONFromFiles(['test/test-environment/a/b/c/.issuerc', 'test/test-environment/a/b/.issuerc']))).toBe(fixtures.configArray);

    });

    it('should generate config object from dot notation input', function () {

        var localConfig = {
            persisted: {
                butAppendedTo: 'option'
            },
            deeply: {
                nested: 'option'
            }
        };

        config.setPersistedPathBase();
        config.setFromDotNotation(localConfig, 'projects.my_awesome_project.url', 'http://my.awesome-project.com/api');
        config.setFromDotNotation(localConfig, 'projects.my_awesome_project.type', 'esoteric_system');
        config.setFromDotNotation(localConfig, 'projects.my_awesome_project.default_user', 'jojo.the.clown');
        config.setFromDotNotation(localConfig, 'deeply', '{"augmented":"by json"}');
        config.setFromDotNotation(localConfig, 'persisted.additional', {
            from: 'object'
        });

        expect(JSON.stringify(localConfig)).toBe(fixtures.updatedConfig);

    });

    it('should parse arguments object', function () {

        expect(JSON.stringify(config.parseArgv(JSON.parse(fixtures.argv)))).toBe(fixtures.cliArguments);

    });

    it('should generate params and options from command line arguments', function () {

        expect(JSON.stringify(config.getParams())).toBe(fixtures.cliArguments);

    });

    it('should generate config object from params options', function () {

        // rely's on `config.getParams()` to work correctly in order for this test to work correctly
        expect(JSON.stringify(config.configObjectFromParamsOptions(config.getParams().options))).toBe(fixtures.cliOptions);

    });

    it('should get layered config from files', function () {

        config.setPersistedPathBase('test/test-environment/a/b/c/', 'test/test-environment');
        expect(JSON.stringify(config.getFileConfig())).toBe(fixtures.secondConfig);

    });

    it('should get layered config from auto-generated arguments, files and command line arguments', function () {

        if (!fs.existsSync('test/test-environment/a/b/c/.git')) {
            fs.mkdirSync('test/test-environment/a/b/c/.git');
        }
        fs.writeFileSync('test/test-environment/a/b/c/.git/config', fixtures.gitConfig);
        config.setPersistedPathBase('test/test-environment/a/b/c/', 'test/test-environment');
        var myconf = config.getConfig();
        delete myconf.width;
        expect(JSON.stringify(config.getConfig())).toBe(fixtures.cliOptionsLayered);

    });

    it('should get git remote url if set', function () {

        if (!fs.existsSync('test/test-environment/a/.git')) {
            fs.mkdirSync('test/test-environment/a/.git');
        }
        fs.writeFileSync('test/test-environment/a/.git/config', fixtures.gitConfigWithRemote);
        config.setPersistedPathBase('test/test-environment/a/b', 'test/test-environment');
        var myconf = config.getConfig();
        delete myconf.width;
        expect(JSON.stringify(config.getConfig())).toBe(fixtures.cliOptionsLayeredGitRemote);

    });

    it('should get one, get all and set value using `config(args...)` function', function () {

        if (!fs.existsSync('test/test-environment/a/b/c/.git')) {
            fs.mkdirSync('test/test-environment/a/b/c/.git');
        }
        fs.writeFileSync('test/test-environment/a/b/c/.git/config', fixtures.gitConfig);
        expect(JSON.stringify(config())).toBe(fixtures.cliOptionsLayered);

    });

    it('should get local config (exclusively from currently active config file)', function () {

        expect(JSON.stringify(config.getLocalConfig())).toBe(fixtures.secondConfig);

    });

    it('should list config in dot notation style', function () {

        expect(config.list()).toBe(fixtures.cliOptionsLayeredList);

        expect(config.list(config.getLocalConfig())).toBe(fixtures.secondConfigList);

    });

    it('should read config value for key specified in dot notation style', function () {

        expect(config.read('option2.part1')).toBe('option2.part1=true');
        expect(config.read('option2.part2')).toBe('option2.part2=false');
        expect(config.read('option4')).toBe('option4=string value');

    });

    it('should get config from only highest file config', function () {

        config.setPersistedPathBase('test/test-environment/a/b', 'test');
        expect(JSON.stringify(config.getLocalConfig())).toBe(fixtures.firstConfig);

        config.setPersistedPathBase('test/test-environment/a/b/c/d', 'test');
        expect(JSON.stringify(config.getLocalConfig())).toBe(fixtures.secondConfig);

        config.setPersistedPathBase('test/test-environment/a', 'test');
        expect(JSON.stringify(config.getLocalConfig())).toBe('{}');

    });

    it('should add key/val to local config', function () {

        config.add('option1', false);
        config.add('option2.part1', true);
        config.add('option2.part2', false);
        expect(JSON.stringify(config.getLocalConfig())).toBe(fixtures.configAfterWrite);
        // return config to original state
        fs.writeFileSync('test/test-environment/a/b/c/.issuerc', fixtures.secondConfig);

    });

    it('should remove config for key specified in dot notation style', function () {

        // setup config file for remove tests
        fs.writeFileSync('test/test-environment/a/b/c/.issuerc', fixtures.cliOptions);
        expect(JSON.stringify(config.getLocalConfig())).toBe(fixtures.cliOptions);
        config.remove('option3');
        expect(JSON.stringify(config.getLocalConfig())).toBe(fixtures.cliOptionsRemovedOption3);
        config.remove('option2.part1');
        expect(JSON.stringify(config.getLocalConfig())).toBe(fixtures.cliOptionsRemovedOption2Part1);
        // return config to original state
        fs.writeFileSync('test/test-environment/a/b/c/.issuerc', fixtures.secondConfig);

    });


});