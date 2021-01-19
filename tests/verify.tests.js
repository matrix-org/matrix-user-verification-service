const axios = require('axios');
const chai = require('chai');
const mockedEnv = require('mocked-env');
const sinon = require('sinon');
const verify = require('../src/verify');

require('../src/logger');

const expect = chai.expect;

describe('verify', function() {
    let axiosStub;
    let originalEnv;

    before(() => {
        originalEnv = mockedEnv({
            UVS_HOMESERVER_URL: 'http://127.0.0.1',
        });
    });

    after(() => {
        originalEnv();
    });

    describe('verifyOpenIDToken', function() {
        afterEach(function() {
            axiosStub.restore();
        });

        it('calls configured homeserver with token', async () => {
            axiosStub = sinon.stub(axios, 'get').returns({data: {sub: '@user:127.0.0.1'}});
            let req = {
                body: {
                    token: 'token',
                },
            };
            const response = await verify.verifyOpenIDToken(req);

            expect(response).to.equal('@user:127.0.0.1');
            expect(axiosStub.calledOnce).to.be.true;
            expect(axiosStub.firstCall.args[0]).to.include(
                'http://127.0.0.1/_matrix/federation/v1/openid/userinfo?access_token=token',
            );
        });

        describe('multiple homeserver mode', () => {
            let originalEnv;

            before(() => {
                originalEnv = mockedEnv({
                    UVS_OPENID_VERIFY_ANY_HOMESERVER: 'true',
                });
            });

            after(() => {
                originalEnv();
            });

            it('calls configured homeserver with token', async () => {
                axiosStub = sinon.stub(axios, 'get').returns({data: {sub: '@user:localhost'}});
                let req = {
                    body: {
                        matrix_server_name: 'http://localhost',
                        token: 'token',
                    },
                };
                const response = await verify.verifyOpenIDToken(req);

                expect(response).to.equal('@user:localhost');
                expect(axiosStub.calledOnce).to.be.true;
                expect(axiosStub.firstCall.args[0]).to.include(
                    'http://localhost/_matrix/federation/v1/openid/userinfo?access_token=token',
                );
            });
        });
    });
});
