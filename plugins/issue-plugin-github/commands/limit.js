(function () {

    'use strict';

    var _ = require('underscore');

    module.exports = function (issueConfig, helper) {

        var api = require('../api.js')(issueConfig(), helper);

        return limit;

        function limit() {

            var w = helper.chalk.white;
            var g = helper.chalk.green;

            return api.rateLimit().then(function (rateLimits) {
                return {
                    stdout: _.map(rateLimits, function (value, name) {
                        return w(name + ' requests: ') + colorLimit(value.remaining, value.limit) + w('/' + value.limit + ', resets in: ') + g(getMinutes(value.reset)) + w(' mins');
                    }).join('\n')
                };
            });

            function colorLimit(value, limit) {

                var color;

                var currentState = value / limit;

                if (currentState < 0.33) {
                    color = helper.chalk.red;
                } else if (currentState < 0.66) {
                    color = helper.chalk.yellow;
                } else {
                    color = helper.chalk.green;
                }

                return color(value);

            }

            function getMinutes(date) {
                return Math.ceil((date * 1000 - new Date()) / 1000 / 60);
            }

        }

    };

})();
