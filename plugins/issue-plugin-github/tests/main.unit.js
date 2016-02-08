/* globals jasmine */

'use strict';

describe('issue github', function () {

    // mock the config function to be passed to github plugin
    var rootpath = '../../../',
        // hijack the issueHelper to inject mocks on ajax function
        pluginHelper = require(rootpath + 'test/plugin-helper'),
        issuemd = require('issuemd'),
        issueTemplates = require(rootpath + 'src/issue-templates.js'),
        github = require('../main.js')(pluginHelper.mockConfig, pluginHelper.issueHelper, issuemd, issueTemplates);

    it('should load as function', function () {

        expect(typeof github).toBe('function');

    });

    // async test uses `done`
    it('should search for specified term (jquery)', function (done) {

        // create spy on the console.log function used to output search results
        console.log = jasmine.createSpy('log');

        // call github plugin function with mocked config and command
        github({
            r: 'jquery',
            answer: 'no',
            plugins: {
                github: {
                    enabled: true
                }
            }
        }, 'search').then(function () {

            // the list of console logs should be 30 long by now - in any order
            expect(console.log.calls.length).toBe(30);

            // should contain jquery/jquery repo in top result
            expect(!!console.log.calls[0].args[0].match('git@github.com:jquery/jquery.git')).toBe(true);

            done();

        });

    });

    it('should search for another specified term (moment)', function (done) {

        // create spy on the console.log function used to output search results
        console.log = jasmine.createSpy('log');

        // call github plugin function with mocked config and command
        github({
            r: 'moment',
            answer: 'no',
            plugins: {
                github: {
                    enabled: true
                }
            }
        }, 'search').then(function () {

            // the list of console logs should be 30 long by now - in any order
            expect(console.log.calls.length).toBe(30);

            // should contain moment/moment repo in top result
            expect(!!console.log.calls[0].args[0].match('git@github.com:moment/moment.git')).toBe(true);

            done();

        });

    });

    it('should show results summary (chance.js)', function (done) {

        // create spy on the console.log function used to output search results
        console.log = jasmine.createSpy('log');

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
        }, 'show').then(function () {

            // the list of console logs should be 30 long by now - in any order
            expect(console.log.calls.length).toBe(1);

            // should contain summary table
            expect(console.log.calls[0].args[0].length).toBe(4047);

            done();

        });

    });

    it('should show paginated results summary (chance.js)', function (done) {

        // create spy on the console.log function used to output search results
        console.log = jasmine.createSpy('log');

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
        }, 'show').then(function () {

            // should have two calls to console.log, one for each summary table
            // the second table should be shorter than a full length summary

            expect(console.log.calls.length).toBe(2);
            expect(console.log.calls[0].args[0].length).toBe(4047);
            expect(console.log.calls[1].args[0].length).toBe(1310);

            done();

        });

    });

});
