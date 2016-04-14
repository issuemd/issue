'use strict';

! function () {

    module.exports = {
        fileExists: fileExists,
        dateStringToIso: dateStringToIso,
        ajax: ajax,
        yesno: yesno,
        promptYesNo: promptYesNo,
        captureCredentials: captureCredentials,
        toBase64: toBase64,
        querystringFromParams: querystringFromParams,
        personFromParts: personFromParts
    };

    // useful since deprication of `fs.exists`
    // http://stackoverflow.com/a/32749571/665261
    function fileExists(filePath) {
        var fs = require('fs');

        try {
            var stats = fs.statSync(filePath);
            return stats.isFile() || stats.isDirectory();
        } catch (err) {
            return false;
        }

    }

    function dateStringToIso(dateString) {
        return new Date(dateString).toISOString();
    }

    function ajax(url, options, data, protocol) {

        var Q = require('q');

        var request = require('request');
        var deferred = Q.defer();

        if (typeof options.json === 'undefined') {
            options.json = true;
        }

        if ((options.method === 'POST' || options.method === 'PATCH' || options.method === 'PUT') && data) {
            options.body = data;
        }

        options.path += url;

        options.rejectUnauthorized = false;

        options.host = (protocol || 'https') + '://' + options.host;

        options.uri = (!/^https?:/.test(url) ? options.host : '') + url;

        request(options, function (err, res, body) {
            if (err) {
                deferred.reject(err);
            } else if (res.statusCode >= 400) {

                // inspired by GitHub API unit tests
                // https://github.com/milo/github-api/blob/f8dc2d4ba958c265a0a6832ad650b1686c5fbe59/src/Github/Api.php#L281

                var HTTP_STATUS_CODES = {
                    '400': 'Bad Request',
                    '401': 'Unauthorized',
                    '403': 'Forbidden',
                    '404': 'Not Found',
                    '422': 'Unprocessable Entity'
                };

                var error = {
                    error: res.statusCode,
                    message: HTTP_STATUS_CODES[res.statusCode] || 'Unknown error',
                    body: body || '',
                    response: res
                };

                deferred.reject(error);

            } else {
                deferred.resolve({
                    data: body,
                    headers: res.headers
                });
            }
        });

        return deferred.promise;

    }

    function yesno(input) {
        return /^(y(e(p|s|ah?))?|sure)$/.test(input);
    }

    function promptYesNo(question, ifYes, ifNo, defaultAnswer) {

        var promptly = require('promptly');

        defaultAnswer = defaultAnswer || 'n';

        promptly.prompt(question, {
            default: defaultAnswer
        }, function (err, value) {
            if (yesno(value)) {
                if (typeof ifYes === 'string') {
                    console.log(ifYes);
                } else if (typeof ifYes === 'function') {
                    ifYes();
                }
            } else {
                if (typeof ifNo === 'string') {
                    console.log('aborted config change');
                } else if (typeof ifNo === 'function') {
                    ifNo();
                }
            }
        });

    }

    function captureCredentials(usernameIn, passwordIn) {

        var promptly = require('promptly'),
            Q = require('q');

        var deferred = Q.defer();

        if (usernameIn && passwordIn) {
            passwordCallback(usernameIn, passwordIn);
        } else if (usernameIn) {
            getPassword(usernameIn, passwordCallback);
        } else {
            getUsername(usernameCallback);
        }

        return deferred.promise;

        function getUsername(callback) {
            promptly.prompt('username: ', function (err, user) {
                callback(user);
            });
        }

        function getPassword(username, callback) {
            promptly.password('password: ', function (err, pass) {
                callback(username, pass);
            });
        }

        function passwordCallback(username, password) {
            deferred.resolve({
                username: username,
                password: password
            });
        }

        function usernameCallback(username) {
            getPassword(username, passwordCallback);
        }

    }

    function toBase64(input) {
        // remedy to the poison...
        //new Buffer("SGVsbG8gV29ybGQ=", 'base64').toString('ascii')
        return new Buffer(input).toString('base64');
    }

    function querystringFromParams(params) {
        var querystring = '';
        if (params) {
            var arr = [];
            for (var param in params) {
                arr.push(param + '=' + params[param]);
            }
            querystring = arr.length > 0 ? '?' + arr.join('&') : '';
        }
        return querystring;
    }

    function personFromParts(parts) {
        var person = [];
        if (parts.fullname && parts.email) {
            person.push(parts.fullname);
            person.push(parts.email);
        }
        if (parts.username) {
            person.push(parts.username);
        }
        return person.join(', ');
    }

}();
