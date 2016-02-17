(function() {

    'use strict';

    module.exports = function(issueConfig) {

        var Q = require('q');

        return function() {
            try {
                issueConfig('plugins.github.authToken', '', true);
                issueConfig('plugins.github.authTokenId', '', true);
                return Q.resolve();
            } catch (e) {
                return Q.reject(e);
            }
        };

    };

})();
