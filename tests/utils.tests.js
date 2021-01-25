const chai = require('chai');
const utils = require('../src/utils');

require('../src/logger');

const expect = chai.expect;

describe('matrixUtils', function() {
    describe('isDomainBlacklisted', () => {
        it('returns correct results', async() => {
            expect(await utils.isDomainBlacklisted('matrix.org')).to.be.false;
            expect(await utils.isDomainBlacklisted('172.16.0.1')).to.be.true;
            expect(await utils.isDomainBlacklisted('::ffff:172.16.0.1')).to.be.true;
        });
    });
});
