'use strict';

module.exports = function (ajax, mode, fixturePath) {

    var nock = require('nock'),
        path = require('path'),
        fs = require('fs'),
        crypto = require('crypto');

    nock.enableNetConnect();
    nock.back.fixtures = path.join(path.dirname(fs.realpathSync(__filename)) + '/..', fixturePath || 'test/mocks/');

    // pass in `record` for mode to store api calls
    // mode = 'record';
    nock.back.setMode(typeof mode === 'string' ? mode : 'lockdown');

    var cacheJax = ajax;

    ajax = function () {
        var myArguments = Array.prototype.slice.call(arguments),
            promise;
        nock.back(crypto.createHash('md5').update(JSON.stringify(myArguments)).digest('hex'), {}, function (nockDone) {
            promise = cacheJax.apply(this, myArguments);
            promise.then(function () {
                nockDone();
            });
        });
        return promise;
    };

    return ajax;

};
