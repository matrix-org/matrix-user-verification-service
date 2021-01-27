const chai = require('chai');
const matrixUtils = require('../src/matrixUtils');
const mockedEnv = require('mocked-env');
const sinon = require('sinon');
const utils = require('../src/utils');
const verify = require('../src/verify');

require('../src/logger');

const expect = chai.expect;

describe('verify', function() {
    let axiosStub;
    let matrixUtilsStub;
    let originalEnv;

    before(() => {
        originalEnv = mockedEnv({
            UVS_HOMESERVER_URL: 'http://synapse.local',
        });
    });

    beforeEach(() => {
        matrixUtilsStub = sinon.stub(matrixUtils, 'discoverHomeserverUrl');
        matrixUtilsStub.onFirstCall().returns({
            homeserverUrl: 'https://synapse.local',
            serverName: 'synapse.local',
        });
    });

    after(() => {
        originalEnv();
    });

    afterEach(function() {
        try {
            axiosStub.restore();
        // eslint-disable-next-line no-empty
        } catch (error) {}
        try {
            matrixUtilsStub.restore();
        // eslint-disable-next-line no-empty
        } catch (error) {}
    });

    describe('verifyOpenIDToken', function() {
        it('calls configured homeserver with token', async () => {
            axiosStub = sinon.stub(utils, 'axiosGet').returns({data: {'sub': '@user:domain.tld'}});
            matrixUtilsStub.onFirstCall().returns({
                homeserverUrl: 'https://domain.tld',
                serverName: 'domain.tld',
            });

            let req = {
                body: {
                    matrix_server_name: 'domain.tld',
                    token: 'token',
                },
            };
            const response = await verify.verifyOpenIDToken(req);

            expect(response).to.equal('@user:domain.tld');
            expect(axiosStub.calledOnce).to.be.true;
            expect(axiosStub.firstCall.args[0]).to.include(
                'https://domain.tld/_matrix/federation/v1/openid/userinfo?access_token=token',
            );
        });

        it('returns false if openid token subject does not match given matrix server name', async () => {
            axiosStub = sinon.stub(utils, 'axiosGet').returns({data: {'sub': '@user:domain.tld'}});

            let req = {
                body: {
                    matrix_server_name: 'synapse.local',
                    token: 'token',
                },
            };
            const response = await verify.verifyOpenIDToken(req);

            expect(response).to.be.false;
            expect(axiosStub.calledOnce).to.be.true;
            expect(axiosStub.firstCall.args[0]).to.include(
                'https://synapse.local/_matrix/federation/v1/openid/userinfo?access_token=token',
            );
        });

        describe('single homeserver mode', () => {
            let originalEnv;

            before(() => {
                originalEnv = mockedEnv({
                    UVS_OPENID_VERIFY_SERVER_NAME: 'matrix.org',
                });
            });

            after(() => {
                originalEnv();
            });

            it('does not call any other homeserver', async function() {
                axiosStub = sinon.stub(utils, 'axiosGet');
                let req = {
                    body: {
                        matrix_server_name: 'synapse.local',
                        token: 'foobar',
                    },
                };
                const response = await verify.verifyOpenIDToken(req);
                expect(response).to.be.false;
                expect(axiosStub.calledOnce).to.be.false;
            });
        });
    });
});
