const chai = require('chai');
const matrixUtils = require('../src/matrixUtils');
const mockedEnv = require('mocked-env');
const sinon = require('sinon');
const routes = require('../src/routes');
const utils = require('../src/utils');

require('../src/logger');

const expect = chai.expect;

describe('routes', function() {
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

    describe('getHealth', function() {
        it('thumbs up', function() {
            axiosStub = sinon.stub(utils, 'axiosGet');
            let req = {};
            let res = {
                send: sinon.spy(),
            };
            routes.getHealth(req, res);

            expect(res.send.calledOnce).to.be.true;
            expect(res.send.firstCall.args[0]).to.equal('👍');
        });
    });

    describe('postVerifyUser', function() {
        it('calls S2S API OpenID userinfo endpoint', async function() {
            axiosStub = sinon.stub(utils, 'axiosGet');
            let req = {
                body: {
                    matrix_server_name: 'synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUser(req, res);
            expect(res.send.calledOnce).to.be.true;
            expect(axiosStub.calledOnce).to.be.true;
            expect(axiosStub.firstCall.args[0]).to.include(
                '/_matrix/federation/v1/openid/userinfo?access_token=foobar',
            );
        });

        it('returns false on invalid token', async function () {
            axiosStub = sinon.stub(utils, 'axiosGet').throws();
            let req = {
                body: {
                    matrix_server_name: 'synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUser(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({results: {user: false}, user_id: null});
            expect(res.send.calledOnce).to.be.true;
        });

        it('returns true and user ID on valid token', async function () {
            axiosStub = sinon.stub(utils, 'axiosGet').returns({data: {sub: '@user:synapse.local'}});
            let req = {
                body: {
                    matrix_server_name: 'synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUser(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({
                results: {user: true}, user_id: '@user:synapse.local',
            });
            expect(res.send.calledOnce).to.be.true;
        });

        describe('authentication', () => {
            let originalEnv;

            before(() => {
                originalEnv = mockedEnv({
                    UVS_AUTH_TOKEN: 'token',
                });
            });

            after(() => {
                originalEnv();
            });

            it('rejects if no token given', async function() {
                axiosStub = sinon.stub(utils, 'axiosGet');
                let req = {
                    body: {
                        matrix_server_name: 'synapse.local',
                        token: 'foobar',
                    },
                    header: () => {},
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUser(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(403);
                expect(axiosStub.calledOnce).to.be.false;
            });

            it('rejects if wrong token given', async function() {
                axiosStub = sinon.stub(utils, 'axiosGet');
                let req = {
                    body: {
                        matrix_server_name: 'synapse.local',
                        token: 'foobar',
                    },
                    header: (header) => {
                        return header === 'Authorization' ? 'Bearer wrongtoken' : '';
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUser(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(403);
                expect(axiosStub.calledOnce).to.be.false;
            });

            it('succeeds if right token given', async function() {
                axiosStub = sinon.stub(utils, 'axiosGet');
                let req = {
                    body: {
                        matrix_server_name: 'synapse.local',
                        token: 'foobar',
                    },
                    header: (header) => {
                        return header === 'Authorization' ? 'Bearer token' : '';
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUser(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.false;
                expect(axiosStub.calledOnce).to.be.true;
            });
        });
    });

    describe('postVerifyUserInRoom', function() {
        it('calls Synapse admin API to verify room membership', async function() {
            axiosStub = sinon.stub(utils, 'axiosGet').returns({data: {sub: '@user:synapse.local'}});
            let req = {
                body: {
                    matrix_server_name: 'synapse.local',
                    room_id: '!barfoo:synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUserInRoom(req, res);

            expect(res.send.calledOnce).to.be.true;
            expect(axiosStub.calledTwice).to.be.true;
            expect(axiosStub.secondCall.args[0]).to.include(
                '/_synapse/admin/v1/rooms/!barfoo:synapse.local/members',
            );
        });

        it('returns false on invalid token', async function() {
            axiosStub = sinon.stub(utils, 'axiosGet').onFirstCall().returns({data: {sub: '@user:synapse.local'}});
            axiosStub.onSecondCall().returns({data: {members: []}});
            let req = {
                body: {
                    matrix_server_name: 'synapse.local',
                    room_id: '!barfoo:synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUserInRoom(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({
                results: {user: true, room_membership: false},
                user_id: '@user:synapse.local',
                power_levels: null,
            });
            expect(res.send.calledOnce).to.be.true;
        });

        it('returns true and user ID on valid token', async function() {
            axiosStub = sinon.stub(utils, 'axiosGet').onFirstCall().returns({data: {sub: '@user:synapse.local'}});
            axiosStub.onSecondCall().returns({data: {members: ['@user:synapse.local']}});
            axiosStub.onThirdCall().returns({data: { state: [
                {
                    type: 'random.state_event',
                },
                {
                    type: 'm.room.power_levels', content: {
                        ban: 50,
                        events: {
                            'm.room.avatar': 50,
                            'm.room.canonical_alias': 50,
                            'm.room.history_visibility': 100,
                            'm.room.name': 50,
                            'm.room.power_levels': 100,
                        },
                        events_default: 0,
                        invite: 0,
                        kick: 50,
                        redact: 50,
                        state_default: 50,
                        users_default: 0,
                        users: {
                            '@user:synapse.local': 100,
                            '@user2:synapse.local': 50,
                        },
                    },
                },
                {
                    type: 'some.other.state_event',
                },
            ]}});
            let req = {
                body: {
                    matrix_server_name: 'synapse.local',
                    room_id: '!barfoo:synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUserInRoom(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({
                results: {user: true, room_membership: true},
                user_id: '@user:synapse.local',
                power_levels: {
                    room: {
                        ban: 50,
                        events: {
                            'm.room.avatar': 50,
                            'm.room.canonical_alias': 50,
                            'm.room.history_visibility': 100,
                            'm.room.name': 50,
                            'm.room.power_levels': 100,
                        },
                        events_default: 0,
                        invite: 0,
                        kick: 50,
                        redact: 50,
                        state_default: 50,
                        users_default: 0,
                    },
                    user: 100,
                },
            });
            expect(res.send.calledOnce).to.be.true;
        });

        describe('authentication', () => {
            let originalEnv;

            before(() => {
                originalEnv = mockedEnv({
                    UVS_AUTH_TOKEN: 'token',
                });
            });

            after(() => {
                originalEnv();
            });

            it('rejects if no token given', async function() {
                axiosStub = sinon.stub(utils, 'axiosGet');
                let req = {
                    body: {
                        matrix_server_name: 'synapse.local',
                        room_id: '!foobar:domain.tld',
                        token: 'foobar',
                    },
                    header: () => {},
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUserInRoom(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(403);
                expect(axiosStub.calledOnce).to.be.false;
            });

            it('rejects if wrong token given', async function() {
                axiosStub = sinon.stub(utils, 'axiosGet');
                let req = {
                    body: {
                        matrix_server_name: 'synapse.local',
                        room_id: '!foobar:domain.tld',
                        token: 'foobar',
                    },
                    header: (header) => {
                        return header === 'Authorization' ? 'Bearer wrongtoken' : '';
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUserInRoom(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.true;
                expect(res.status.firstCall.args[0]).to.equal(403);
                expect(axiosStub.calledOnce).to.be.false;
            });

            it('succeeds if right token given', async function() {
                axiosStub = sinon.stub(utils, 'axiosGet');
                let req = {
                    body: {
                        matrix_server_name: 'synapse.local',
                        room_id: '!foobar:domain.tld',
                        token: 'foobar',
                    },
                    header: (header) => {
                        return header === 'Authorization' ? 'Bearer token' : '';
                    },
                };
                let res = {
                    send: sinon.spy(),
                    status: sinon.spy(),
                };
                await routes.postVerifyUserInRoom(req, res);
                expect(res.send.calledOnce).to.be.true;
                expect(res.status.calledOnce).to.be.false;
                expect(axiosStub.calledOnce).to.be.true;
            });
        });
    });
});
