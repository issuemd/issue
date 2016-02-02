/**
 * issue-config module
 * 
 * main purpose is to layer `.issurc` config files, and command line options to generate app config
 * also, exposes api for main app, and plugins to interact with app config for reading and writing
 *
 * Usage:
 *
 *    config() // get fully layered config (all config files, command line args, and auto generated config)
 *    config('deeply.nested.item') // get value for single dot notation specified key
 *    config('deeply.nested.item','value') // set value for single dot notation specified key
 *    config('deeply.nested.item','value', true) // set value of home config for single dot notation specified key
 *    config('deeply.nested.item',{full:'object'}) // set value as object for single dot notation specified key
 *    config('item', null) // remove item specified by key
 *    config('item', null, true) // remove item from home config specified by key
 *
 */

'use strict';

! function () {

    var path = require('path'),
        fs = require('fs'),
        _ = require('underscore');

    var argv;

    _.mixin({
        deepExtend: function (obj) {
            var parentRE = /#{\s*?_\s*?}/,
                slice = Array.prototype.slice;

            _.each(slice.call(arguments, 1), function (source) {
                for (var prop in source) {
                    if (_.isUndefined(obj[prop]) || _.isFunction(obj[prop]) || _.isNull(source[prop]) || _.isDate(source[prop])) {
                        obj[prop] = source[prop];
                    } else if (_.isString(source[prop]) && parentRE.test(source[prop])) {
                        if (_.isString(obj[prop])) {
                            obj[prop] = source[prop].replace(parentRE, obj[prop]);
                        }
                    } else if (_.isArray(obj[prop]) || _.isArray(source[prop])) {
                        if (!_.isArray(obj[prop]) || !_.isArray(source[prop])) {
                            throw new Error('Trying to combine an array with a non-array (' + prop + ')');
                        } else {
                            obj[prop] = _.reject(_.deepExtend(_.clone(obj[prop]), source[prop]), _.isNull);
                        }
                    } else if (_.isObject(obj[prop]) || _.isObject(source[prop])) {
                        if (!_.isObject(obj[prop]) || !_.isObject(source[prop])) {
                            throw new Error('Trying to combine an object with a non-object (' + prop + ')');
                        } else {
                            obj[prop] = _.deepExtend(_.clone(obj[prop]), source[prop]);
                        }
                    } else {
                        obj[prop] = source[prop];
                    }
                }
            });
            return obj;
        }
    });

    module.exports = function () {

        var internalConfig,
            persistedPath = process.cwd(),
            persistedBase = null;

        var config = function (key, value, home) {
            if (!!key && typeof value !== 'undefined') {
                if (value === null) {
                    return remove(key, home);
                } else {
                    return add(key, value, home);
                }
            } else if (!!key) {
                return read(key);
            } else {
                return getConfig();
            }
        };

        config.list = list;
        config.init = init;

        if (process.env.TESTING) {
            config.read = read;
            config.add = add;
            config.remove = remove;
            config.getConfig = getConfig;
            config.setPersistedPathBase = setPersistedPathBase;
            config.getFileConfig = getFileConfig;
            config.getConfigFiles = getConfigFiles;
            config.getJSONFromFiles = getJSONFromFiles;
            config.getLocalConfig = getLocalConfig;
            config.setFromDotNotation = setFromDotNotation;
            config.getPaths = getPaths;
            config.parseArgv = parseArgv;
            config.getParams = getParams;
            config.configObjectFromParamsOptions = configObjectFromParamsOptions;
        }

        return config;

        /*** utility functions placed inside `module.exports` enclosure to gain access to `utils` and `argv` ***/

        function init(argvIn) {
            argv = argvIn;
            return config;
        }

        function setPersistedPathBase(pathIn, baseIn) {
            // if paths change, internal config must be re-calculated
            internalConfig = false;
            persistedPath = pathIn || process.cwd();
            persistedBase = baseIn || null;
        }

        function getPaths() {

            var paths = [],
                currentPath = path.resolve(persistedPath),
                nextPath = currentPath;

            // 99 chosen as adequite depth to ascend through folder tree
            for (var i = 0; i < 99; i++) {
                currentPath = nextPath;
                paths.push(path.relative(process.cwd(), currentPath));
                nextPath = path.join(currentPath, '..');
                if ((currentPath === nextPath) || persistedBase && currentPath === path.resolve(persistedBase)) {
                    break;
                }
            }

            if (process.platform === 'win32') {
                paths.push(process.env.USERPROFILE);
            }

            return paths;

        }

        function getConfigFiles() {
            var configs = [];
            _.each(getPaths(), function (mypath) {
                if (fs.existsSync(path.join(mypath, '.issuerc'))) {
                    configs.push(path.join(mypath, '.issuerc'));
                }
            });
            return configs;
        }

        function getAutoConfig() {
            var ini = require('ini');
            var myConfig = {};
            _.each(getPaths(), function (mypath) {
                if (!(myConfig.git && myConfig.git.projectPath) && fs.existsSync(path.join(mypath, '.git/config'))) {
                    myConfig.git = myConfig.git || {};
                    myConfig.git.projectPath = mypath;

                    var gitConfig = ini.parse(fs.readFileSync(path.join(mypath, '.git/config'), 'utf-8'));

                    if (gitConfig['remote "origin"']) {

                        if (gitConfig['remote "origin"'].url) {
                            myConfig.git.remote = gitConfig['remote "origin"'].url;
                        }

                    }
                }
            });
            myConfig = _.defaults(myConfig, {
                width: process.stdout.columns - (process.platform === 'win32' ? 1 : 0)
            });
            return myConfig;
        }

        function getJSONFromFiles(files) {
            var jsons = [];
            _.each(files, function (file) {
                var fileJson = fs.readFileSync(file).toString('UTF-8');
                try {
                    jsons.push(JSON.parse(fileJson));
                } catch (e) {
                    throw new Error('failed to parse json from file: ' + file);
                }
            });
            return jsons;
        }

        function getFileConfig() {
            return _.defaults.apply(null, getJSONFromFiles(getConfigFiles()));
        }

        function setFromDotNotation(configIn, pathIn, valueIn) {
            var myPath = pathIn.split('.'),
                destination = configIn,
                value;
            for (var i = 0; i < myPath.length - 1; i++) {
                destination = (destination[myPath[i]]) ? destination[myPath[i]] : destination[myPath[i]] = {};
            }
            try {
                var parsed = JSON.parse(valueIn);
                value = _.isObject(parsed) ? _.deepExtend({}, destination[myPath[myPath.length - 1]], parsed) : parsed;
            } catch (e) {
                value = valueIn;
            }
            destination[myPath[myPath.length - 1]] = value;
            return configIn;
        }

        // inspired by: http://tokenposts.blogspot.com.au/2012/04/javascript-objectkeys-browser.html
        function objectKeys(object) {

            var keys = [],
                property;
            for (property in object) {
                if (Object.prototype.hasOwnProperty.call(object, property)) {
                    keys.push(property);
                }
            }
            return keys;

        }

        function removeFromDotNotation(configIn, pathIn) {

            var myPath = pathIn.split('.'),
                destination = configIn;

            for (var i = 0; i < myPath.length - 1; i++) {
                destination = (destination[myPath[i]]) ? destination[myPath[i]] : destination[myPath[i]] = {};
            }

            delete destination[myPath[myPath.length - 1]];

            // if removing path leaves object empty, remove the parent (recursively)
            if (objectKeys(destination).length === 0) {
                removeFromDotNotation(configIn, myPath.slice(0, -1).join('.'));
            }

            return configIn;

        }

        function parseArgv(argvIn) {
            var consuming = false,
                out = {
                    params: [],
                    options: {}
                };

            function sanitize(input) {
                var value;
                switch (input) {
                    case 'true':
                    case 'on':
                        value = true;
                        break;
                    case 'null':
                        value = null;
                        break;
                    case 'false':
                    case 'off':
                        value = false;
                        break;
                    default:
                        value = input;
                        break;
                }
                return value;
            }
            argvIn.slice(2).forEach(function (input) {
                var matches = input.match(/^-?-(\w.*)/);
                if (matches) {
                    if (consuming) {
                        out.options = setFromDotNotation(out.options, consuming, true);
                    }
                    consuming = matches[1];
                } else if (consuming) {
                    out.options = setFromDotNotation(out.options, consuming, sanitize(input));
                    consuming = false;
                } else {
                    out.params.push(sanitize(input));
                }
            });

            // if last option does not explicitly set value, assume true
            if (consuming) {
                out.options = setFromDotNotation(out.options, consuming, true);
            }

            return out;
        }

        function getParams() {
            return parseArgv(argv);
        }

        function configObjectFromParamsOptions(optionsIn) {

            var localConfig = {};

            _.each(optionsIn, function (value, key) {
                setFromDotNotation(localConfig, key, value);
            });

            return localConfig;
        }

        function deleteNull(myObject) {
            for (var i in myObject) {
                if (myObject[i] === null) {
                    delete myObject[i];
                } else if (typeof myObject[i] === 'object') {
                    deleteNull(myObject[i]);
                }
            }
        }

        function getConfig() {

            if (!internalConfig) {

                var paramsConfig = configObjectFromParamsOptions(getParams());
                paramsConfig.options.params = paramsConfig.params;
                var configs = [
                    getAutoConfig(),
                    paramsConfig.options
                ].concat(
                    getJSONFromFiles(getConfigFiles())
                );

                configs = getJSONFromFiles(getConfigFiles()).reverse();
                configs.unshift(paramsConfig.options);
                configs.unshift(getAutoConfig());

                internalConfig = _.deepExtend.apply(null, configs);
                internalConfig = _.deepExtend(internalConfig, paramsConfig.options);
                if (internalConfig.project && internalConfig.projects[internalConfig.project]) {
                    internalConfig = _.deepExtend(internalConfig, internalConfig.projects[internalConfig.project]);
                }

                deleteNull(internalConfig);

            }

            return internalConfig;

        }

        function getLocalConfig() {

            return getJSONFromFiles(getConfigFiles())[0] || {};

        }

        function getHomeConfigFilename() {

            // heavily inspired by: https://github.com/npm/osenv/blob/769ada6737026254372e3013b702c450a9b781e9/osenv.js#L52
            return path.join((process.platform === 'win32' ? process.env.USERPROFILE : process.env.HOME), '.issuerc');

        }

        // from: http://stackoverflow.com/a/13218838/665261
        function list(configIn) {
            var myConfig = configIn || config();
            var res = [];

            function recurse(myConfig, current) {
                var newKey, value;
                for (var key in myConfig) {
                    value = myConfig[key];
                    if (!!current) {
                        if (/^\d+$/.test(key)) {
                            newKey = current + '[' + key + ']';
                        } else {
                            newKey = current + '.' + key;
                        }
                    } else {
                        newKey = key;
                    }
                    if (value && typeof value === 'object') {
                        recurse(value, newKey); // it's a nested object, so do it again
                    } else {
                        res.push(newKey + '=' + value);
                    }
                }
            }
            recurse(myConfig);
            return res.join('\n');
        }

        /* Dot notation object read/write (for config) */
        // heavily inspired by: http://stackoverflow.com/a/9338230/665261
        function read(pathIn) {
            var myConfig = configObjectFromParamsOptions(getConfig());
            var myPath = pathIn.split('.');
            for (var i = 0; i < myPath.length; i++) {
                myConfig = typeof myConfig[myPath[i]] !== 'undefined' ? myConfig[myPath[i]] : myConfig[myPath[i]] = {};
            }
            var x = {};
            x[pathIn] = myConfig;
            return typeof myConfig === 'object' ? list(x) : pathIn + '=' + myConfig;
        }

        function add(pathIn, value, home) {
            var myConfig = !!home ? getJSONFromFiles([getHomeConfigFilename()])[0] : getLocalConfig();
            setFromDotNotation(myConfig, pathIn, value);
            if (internalConfig) {
                setFromDotNotation(internalConfig, pathIn, value);
            }
            return write(myConfig, home);
        }

        function remove(pathIn, home) {
            var myConfig = !!home ? getJSONFromFiles([getHomeConfigFilename()])[0] : getLocalConfig();
            removeFromDotNotation(myConfig, pathIn);
            if (internalConfig) {
                removeFromDotNotation(internalConfig, pathIn);
            }
            return write(myConfig, home);
        }

        function write(myConfig, home) {
            var currentConfigFile = home ? getHomeConfigFilename() : getConfigFiles()[0];
            try {
                fs.writeFileSync(currentConfigFile, JSON.stringify(myConfig, null, 4));
                return 0;
            } catch (e) {
                return 1;
            }
        }

    }();


}.call();