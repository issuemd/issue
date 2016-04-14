(function () {

    'use strict';

    var _ = require('underscore');

    module.exports = function (helper, api) {

        return limit;

        function limit() {

            return api.rateLimit().then(function (rateLimits) {
                return {
                    stdout: _.map(rateLimits, function (value, name) {
                        return helper.info(name + ' requests (reset in '+getMinutes(value.reset)+' mins)', value.remaining + '/' + value.limit);
                    }).join('\n')
                };
            });

            function getMinutes(date) {
                return Math.ceil((date * 1000 - new Date()) / 1000 / 60);
            }

        }

    };

})();
