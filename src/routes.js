const {
    sanityCheckRequest,
    verifyOpenIDToken,
    verifyRoomMembership,
} = require('./verify');
const logger = require('./logger');
const {requestLogger} = require('./utils');

const routes = {
    getHealth: (req, res) => {
        requestLogger(req);
        res.send('👍');
    },
    postVerifyUser: async(req, res) => {
        requestLogger(req);
        const checkResult = sanityCheckRequest(req, res, ['token']);
        if (!checkResult) {
            logger.log('info', 'Request sanity check failed.');
            return;
        }
        const tokenResult = await verifyOpenIDToken(req.body.token);
        if (!tokenResult) {
            res.send({
                results: { user: false },
                user_id: null,
            });
            logger.log('info', 'User token check failed.');
            return false;
        }
        res.send({
            results: { user: true },
            user_id: tokenResult,
        });
        logger.log('info', 'User token checks out, user verified.');
    },
    postVerifyUserInRoom: async(req, res) => {
        requestLogger(req);
        const checkResult = sanityCheckRequest(req, res, ['token', 'room_id']);
        if (!checkResult) {
            logger.log('info', 'Request sanity check failed.');
            return;
        }
        const tokenResult = await verifyOpenIDToken(req.body.token);
        if (!tokenResult) {
            res.send({
                results: { user: false, room_membership: null },
                user_id: null,
            });
            logger.log('info', 'User token check failed.');
            return false;
        }
        // noinspection JSUnresolvedVariable
        const membershipResult = await verifyRoomMembership(tokenResult, req.body.room_id);
        if (!membershipResult) {
            res.send({
                results: { user: true, room_membership: false },
                user_id: tokenResult,
            });
            logger.log('info', 'User verified but room membership check failed.');
            return;
        }
        res.send({
            results: { user: true, room_membership: true },
            user_id: tokenResult,
        });
        logger.log('info', 'Token and room membership check out, user verified.');
    },
};

module.exports = routes;
