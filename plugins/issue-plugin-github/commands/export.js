(function () {

    'use strict';

    var _ = require('underscore'),
        Q = require('q');

    module.exports = function (issueConfig, helper, api, issuemd) {

        var fetchIssue = require('../json-to-issuemd')(issueConfig, helper, api, issuemd);

        return handleExport;

        function handleExport(config) {

            var deferred = Q.defer();

            var filters = _.pick(config, 'filter', 'state', 'labels', 'sort', 'direction', 'since');

            var issueList = [];

            api.getIssues(config.githubrepo.namespace, config.githubrepo.id, filters)
                .progress(deferred.notify)
                .then(api.pages)
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
                            filename = path.join(mypath, config.githubrepo.id + '-' + issueInfo.number + '.issue.md');
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
                        api.getIssue(config.githubrepo.namespace, config.githubrepo.id, issueId)
                            .then(fetchIssue)
                            .then(function (issue) {
                                writeIssueToDisk(issue);
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
