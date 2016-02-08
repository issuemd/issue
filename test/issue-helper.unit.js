'use strict';

describe('issue helper', function () {

    var helper = require('../src/issue-helper.js')(require('../src/issue-config.js')());


    describe('dateStringToIso', function () {

        it('should format ISO date without time to full ISO date', function () {
            expect(helper.dateStringToIso('12-12-2015')).toBe('2015-12-12T00:00:00.000Z');
        });

        it('should format ISO date with time to full ISO date', function () {
            expect(helper.dateStringToIso('2015-12-12T15:30:30')).toBe('2015-12-12T15:30:30.000Z');
        });

        it('should return the same ISO string', function () {
            expect(helper.dateStringToIso('2015-05-16T20:57:18.542Z')).toBe('2015-05-16T20:57:18.542Z');
        });

    });

});
