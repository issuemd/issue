'use strict';

describe('issue utils', function () {

    var utils = require('../src/issue-utils.js');


    describe('dateStringToIso', function () {

        it('should format ISO date without time to full ISO date', function () {
            expect(utils.dateStringToIso('12-12-2015')).toBe('2015-12-12T00:00:00.000Z');
        });

        it('should format ISO date with time to full ISO date', function () {
            expect(utils.dateStringToIso('2015-12-12T15:30:30')).toBe('2015-12-12T15:30:30.000Z');
        });

        it('should return the same ISO string', function () {
            expect(utils.dateStringToIso('2015-05-16T20:57:18.542Z')).toBe('2015-05-16T20:57:18.542Z');
        });

    });

});
