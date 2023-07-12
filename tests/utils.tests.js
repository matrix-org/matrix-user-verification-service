const axios = require('axios');
const chai = require('chai');
const sinon = require('sinon');
const utils = require('../src/utils');

require('../src/logger');

const expect = chai.expect;

describe('matrixUtils', function() {
    describe('axiosGet', () => {
        let axiosStub;

        afterEach(() => {
            axiosStub.restore();
        });

        it('ensures domain is not blacklisted', async() => {
            axiosStub = sinon.stub(axios, 'get');
            let raised;
            try {
                await utils.axiosGet('http://127.0.0.1');
                raised = false;
            } catch (error) {
                raised = true;
            }
            expect(raised).to.be.true;
            expect(axiosStub.called).to.be.false;
        });

it('ensures redirection domain is not blacklisted', async() => {
    axiosStub = sinon.stub(axios, 'get');
                                                                 
    axiosStub.onFirstCall().returns({
        headers: {
            location: 'http://127.0.0.1',
        },
        status: 301,
    });
    axiosStub.onSecondCall().returns({status: 200});
                                                                 
    let raised;
    try {
        await utils.axiosGet('https://matrix.org');
        raised = false;
    } catch (error) {
        raised = true;
    }
                                                                 
    expect(raised).to.be.true;
    expect(axiosStub.calledOnce).to.be.true;
    expect(axiosStub.calledTwice).to.be.false;
});

        it('calls axios', async() => {
            axiosStub = sinon.stub(axios, 'get');
            try {
                await utils.axiosGet('https://matrix.org');
            } catch (error) {
                // pass
            }
            expect(axiosStub.called).to.be.true;
        });

        it('calls axios twice on a redirect', async() => {
            axiosStub = sinon.stub(axios, 'get');
            axiosStub.onFirstCall().returns({
                headers: {
                    location: 'https://matrix.to',
                },
                status: 301,
            });
            axiosStub.onSecondCall().returns({status: 200});
            try {
                await utils.axiosGet('https://matrix.org');
            } catch (error) {
                // pass
            }
            expect(axiosStub.firstCall.args[0]).to.equal('https://matrix.org');
            expect(axiosStub.secondCall.args[0]).to.equal('https://matrix.to');
        });

        it('returns a response', async() => {
            axiosStub = sinon.stub(axios, 'get').returns({status: 200});
            let response;
            try {
                response = await utils.axiosGet('https://matrix.org');
            } catch (error) {
                // pass
            }
            expect(axiosStub.called).to.be.true;
            expect(response).to.deep.equal({status: 200});
        });
    });

    describe('isBlacklisted', () => {
        it('returns correct results', async() => {
            expect(await utils.isBlacklisted('8.8.8.8')).to.be.false;
            expect(await utils.isBlacklisted(['172.16.0.1'])).to.be.true;
            expect(await utils.isBlacklisted(['::ffff:172.16.0.1'])).to.be.true;
            expect(await utils.isBlacklisted(['::ffff:8.8.8.8'])).to.be.false;
        });
    });

    describe('resolveDomain', () => {
        it('returns correct results', async() => {
            expect(await utils.resolveDomain('matrix.org')).to.have.lengthOf.above(0);
            expect(await utils.resolveDomain('test.local')).to.have.lengthOf(0);
            expect(await utils.resolveDomain('test.example.com')).to.have.lengthOf(0);
        });
    });
});
