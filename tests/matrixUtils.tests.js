const chai = require('chai');
const matrixUtils = require('../src/matrixUtils');

require('../src/logger');

const expect = chai.expect;

describe('matrixUtils', function() {
    describe('parseHostnameAndPort', function() {
        it('returns correct results', async () => {
            expect(matrixUtils.parseHostnameAndPort('matrix.org')).to.deep.equal({
                hostname: 'matrix.org',
                port: '8448',
                defaultPort: true,
            });
            expect(matrixUtils.parseHostnameAndPort('matrix.org:1234')).to.deep.equal({
                hostname: 'matrix.org',
                port: '1234',
                defaultPort: false,
            });
        });
    });

    describe('validateDomain', function() {
        it('returns correct results', async () => {
            expect(matrixUtils.validateDomain('matrix.org')).to.be.true;
            expect(matrixUtils.validateDomain('matrix.domain.tld')).to.be.true;

            expect(matrixUtils.validateDomain('1.2.3.4')).to.be.false;
            expect(matrixUtils.validateDomain('1234:5678::abcd')).to.be.false;
            expect(matrixUtils.validateDomain('matrix')).to.be.false;
            expect(matrixUtils.validateDomain('matrix org')).to.be.false;
            expect(matrixUtils.validateDomain('42')).to.be.false;
        });
    });
});
