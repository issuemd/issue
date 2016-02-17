(function () {

    'use strict';

    var _ = require('underscore'),
        Q = require('q');

    module.exports = function (issueConfig, helper, issuemd) {

        var issueFromApiJson = _.partial(require('./json-to-issuemd'), issuemd, helper);
        var github = require('./github.js')(issueConfig, helper, issuemd);

        return handleExport;

        function handleExport(config) {

            var deferred = Q.defer();

            var repo = github.autoDetectRepo(config.repo, config.plugins.github.autodetect !== false, config.git && config.git.remote);

            var filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

            var issueList = [];

            github.listIssues(repo.namespace, repo.id, filters)
                .then(github.pages)
                .then(function (response) {

                    issueList = issueList.concat(_.map(response, function (item) {
                        return _.pick(item, 'number', 'updated_at');
                    }));

                    var stale = [];

                    _.each(issueList, function (issueInfo) {

                        var path = require('path'),
                            fs = require('fs'),
                            localissue,
                            localdate,
                            remotedate = new Date(issueInfo.updated_at), // jshint ignore:line
                            mypath = path.resolve(config.dest),
                            filename = path.join(mypath, repo.id + '-' + issueInfo.number + '.issue.md');
                        try {
                            localissue = issuemd(fs.readFileSync(filename, 'utf8'));
                            localdate = new Date(localissue.eq(0).updates().reduce(function (memo, event) {
                                return event.type !== 'reference' ? event.modified : memo; // jshint ignore:line
                            }, localissue.attr('created')));
                        } catch (e) {
                            if (e.code !== 'ENOENT') {
                                deferred.notify(e);
                            }
                        }
                        if (!localissue || localdate < remotedate) {
                            stale.push(issueInfo.number);
                        }

                    });

                    // TODO: make this more in line with promises way of doing things
                    return limitEach(stale, config.throttle, function (issueId, cb) {
                        github.fetchIssue(repo.namespace, repo.id, issueId, filters)
                            .then(function (response) {
                                writeIssueToDisk(issueFromApiJson(response));
                                cb();
                            });
                    });

                }).then(deferred.resolve);

            return deferred.promise;

            // http://stackoverflow.com/a/35422593/665261
            function limitEach(arr, max, fn) {

                var counter = 0,
                    index = 0,
                    limitDeferred = Q.defer();

                runMore();

                function runMore() {
                    // default to 10 concurrent connections
                    while (counter < (max || 10) && index < arr.length) {
                        ++counter;
                        fn(arr[index++], handler);
                    }
                    if (counter === 0 && index === arr.length) {
                        limitDeferred.resolve();
                    }
                }

                function handler(err) {
                    --counter;
                    if (err) {
                        limitDeferred.reject(err);
                    } else {
                        runMore();
                    }
                }

                return limitDeferred.promise;

            }

            function writeIssueToDisk(issues) {

                var path = require('path'),
                    fs = require('fs'),
                    mkdirp = require('mkdirp'),
                    mypath = path.resolve(config.dest),
                    filename;

                issues.each(function (issue) {

                    try {
                        mkdirp.sync(mypath);
                        fs.accessSync(mypath);
                        filename = path.join(mypath, issue.attr('project') + '-' + issue.attr('number') + '.issue.md');
                        fs.writeFileSync(filename, issue.md());
                        deferred.notify({
                            stderr: 'Writing to disk: ' + path.relative(process.cwd(), filename)
                        });
                    } catch (e) {
                        deferred.notify({
                            stderr: e.message
                        });
                    }

                });

            }

        }

    };

})();
