const axios = require('axios');
const chai = require('chai');
const sinon = require('sinon');
const routes = require('../src/routes');

require('../src/logger');

const expect = chai.expect;

describe('app', function() {
    let axiosStub;

    afterEach(function() {
        axiosStub.restore();
    });

    describe('getHealth', function() {
        it('thumbs up', function() {
            axiosStub = sinon.spy(axios, 'get');
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
            axiosStub = sinon.spy(axios, 'get');
            let req = {
                body: {
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
            axiosStub = sinon.stub(axios, 'get').throws();
            let req = {
                body: {
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
            axiosStub = sinon.stub(axios, 'get').returns({data: {sub: '@user:synapse.local'}});
            let req = {
                body: {
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
    });

    describe('postVerifyUserInRoom', function() {
        it('calls Synapse admin API to verify room membership', async function() {
            axiosStub = sinon.stub(axios, 'get').returns({data: {sub: '@user:synapse.local'}});
            let req = {
                body: {
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
            axiosStub = sinon.stub(axios, 'get').onFirstCall().returns({data: {sub: '@user:synapse.local'}});
            axiosStub.onSecondCall().returns({data: {members: []}});
            let req = {
                body: {
                    room_id: '!barfoo:synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUserInRoom(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({
                results: {user: true, room_membership: false}, user_id: '@user:synapse.local',
            });
            expect(res.send.calledOnce).to.be.true;
        });

        it('returns true and user ID on valid token', async function() {
            axiosStub = sinon.stub(axios, 'get').onFirstCall().returns({data: {sub: '@user:synapse.local'}});
            axiosStub.onSecondCall().returns({data: {members: ['@user:synapse.local']}});
            let req = {
                body: {
                    room_id: '!barfoo:synapse.local',
                    token: 'foobar',
                },
            };
            let res = {
                send: sinon.spy(),
            };
            await routes.postVerifyUserInRoom(req, res);

            expect(res.send.firstCall.args[0]).to.deep.equal({
                results: {user: true, room_membership: true}, user_id: '@user:synapse.local',
            });
            expect(res.send.calledOnce).to.be.true;
        });
    });
});
