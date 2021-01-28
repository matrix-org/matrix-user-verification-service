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

    describe('isDomainBlacklisted', () => {
        it('returns correct results', async() => {
            expect(await utils.isDomainBlacklisted('matrix.org')).to.be.false;
            expect(await utils.isDomainBlacklisted('172.16.0.1')).to.be.true;
            expect(await utils.isDomainBlacklisted('::ffff:172.16.0.1')).to.be.true;
        });
    });
});
