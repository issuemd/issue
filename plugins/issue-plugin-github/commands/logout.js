(function () {

    'use strict';

    module.exports = function (issueConfig, helper, issuemd) {

        var github = require('../github.js')(issueConfig, helper, issuemd);

        return github.removeCredentials;
    };

})();
