'use strict';

describe('issue github', function () {

    var _ = require('underscore');

    // mock the config function to be passed to github plugin
    var rootpath = '../../../',
        // hijack the issueHelper to inject mocks on ajax function
        pluginHelper = require(rootpath + 'test/plugin-helper'),
        issuemd = pluginHelper.issuemd,
        github = require('../issue-plugin-github.js')(pluginHelper.issueHelper, issuemd);

    it('should load as function', function () {

        expect(typeof github).toBe('function');

    });

    _.each(['jquery', 'moment'], function (item) {

        it('should search for another specified term (' + item + ')', function (done) {

            // call github plugin function with mocked config and command
            github({
                params: [item],
                answer: 'no',
                plugins: {
                    github: {
                        enabled: true
                    }
                }
            }, 'locate').then(function (result) {

                // should contain item namespace in top result
                expect(new RegExp('^' + item).test(result.stdout)).toBe(true);

                done();

            });

        });

    });

    it('should show results summary (chance.js)', function (done) {

        // call github plugin function with mocked config and command
        github({
            params: [],
            answer: 'no',
            repo: 'victorquinn/chancejs',
            plugins: {
                github: {
                    enabled: true
                }
            }
        }, 'show').then(function (result) {

            expect(result.stdout.length).toBe(4288);

            done();

        });

    });

    it('should show paginated results summary (chance.js)', function (done) {

        // call github plugin function with mocked config and command
        github({
            params: [],
            answer: 'yes',
            repo: 'victorquinn/chancejs',
            plugins: {
                github: {
                    enabled: true
                }
            }
        }, 'show').then(function (result) {

            expect(result.stdout.length).toBe(4288);

            result.next().then(function (result) {
                expect(result.stdout.length).toBe(605);
                done();
            });

        });

    });

});
