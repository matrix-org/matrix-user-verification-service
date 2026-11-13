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

    describe('getRoomPowerLevels', function() {
        const creator = '@creator:domain.tld';
        const additionalCreator = '@additional:domain.tld';
        const member = '@member:domain.tld';
        const moderator = '@moderator:domain.tld';

        // A fresh state for every call: getRoomPowerLevels deletes `users` from the
        // power levels content it is given.
        function roomState(roomVersion, additionalCreators) {
            const createContent = {};
            if (roomVersion !== undefined) {
                createContent.room_version = roomVersion;
            }
            if (additionalCreators !== undefined) {
                createContent.additional_creators = additionalCreators;
            }
            return {
                data: {
                    state: [
                        {type: 'm.room.create', state_key: '', sender: creator, content: createContent},
                        {
                            type: 'm.room.power_levels',
                            state_key: '',
                            sender: creator,
                            content: {users: {[moderator]: 50}, users_default: 0, state_default: 50},
                        },
                    ],
                },
            };
        }

        async function levelFor(userId, roomVersion, additionalCreators) {
            axiosStub = sinon.stub(utils, 'axiosGet').returns(roomState(roomVersion, additionalCreators));
            const response = await verify.getRoomPowerLevels(userId, {body: {room_id: '!room:domain.tld'}});
            axiosStub.restore();
            return response;
        }

        it('returns users_default for a creator not listed in users before room version 12', async () => {
            for (const version of [undefined, '1', '10', '11']) {
                const response = await levelFor(creator, version);
                expect(response.user, `room version ${version}`).to.equal(0);
            }
        });

        it('returns maximum power for the creator of a room version 12 room', async () => {
            const response = await levelFor(creator, '12');
            expect(response.user).to.equal(Number.MAX_SAFE_INTEGER);
            expect(response.room.state_default).to.equal(50);
            expect(response.room.users).to.be.undefined;
        });

        it('returns maximum power for an additional creator of a room version 12 room', async () => {
            const response = await levelFor(additionalCreator, '12', [additionalCreator]);
            expect(response.user).to.equal(Number.MAX_SAFE_INTEGER);
        });

        it('returns maximum power for the creator of an org.matrix.hydra.11 room', async () => {
            const response = await levelFor(creator, 'org.matrix.hydra.11');
            expect(response.user).to.equal(Number.MAX_SAFE_INTEGER);
        });

        it('does not change other users in a room version 12 room', async () => {
            expect((await levelFor(moderator, '12', [additionalCreator])).user).to.equal(50);
            expect((await levelFor(member, '12', [additionalCreator])).user).to.equal(0);
        });

        it('ignores additional_creators before room version 12', async () => {
            const response = await levelFor(additionalCreator, '11', [additionalCreator]);
            expect(response.user).to.equal(0);
        });
    });
});
