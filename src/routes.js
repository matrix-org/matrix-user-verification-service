const {
    getRoomPowerLevels,
    sanityCheckRequest,
    verifyOpenIDToken,
    verifyRoomMembership,
} = require('./verify');
const logger = require('./logger');
const {
    authenticateRequest,
    requestLogger,
} = require('./utils');

const routes = {
    getHealth: (req, res) => {
        requestLogger(req);
        res.send('👍');
    },
    postVerifyUser: async(req, res) => {
        requestLogger(req);
        const authenticated = authenticateRequest(req, res);
        if (!authenticated) {
            return;
        }
        const fields = ['token'];
        if (process.env.UVS_OPENID_VERIFY_ANY_HOMESERVER === 'true') {
            fields.push('matrix_server_name');
        }
        const checkResult = sanityCheckRequest(req, res, fields);
        if (!checkResult) {
            logger.log('info', 'Request sanity check failed.', {requestId: req.requestId});
            return;
        }
        const tokenResult = await verifyOpenIDToken(req);
        if (!tokenResult) {
            res.send({
                results: { user: false },
                user_id: null,
            });
            logger.log('info', 'User token check failed.', {requestId: req.requestId});
            return;
        }
        res.send({
            results: { user: true },
            user_id: tokenResult,
        });
        logger.log('info', 'User token checks out, user verified.', {requestId: req.requestId});
    },
    postVerifyUserInRoom: async(req, res) => {
        requestLogger(req);
        const authenticated = authenticateRequest(req, res);
        if (!authenticated) {
            return;
        }
        const fields = ['token', 'room_id'];
        if (process.env.UVS_OPENID_VERIFY_ANY_HOMESERVER === 'true') {
            fields.push('matrix_server_name');
        }
        const checkResult = sanityCheckRequest(req, res, fields);
        if (!checkResult) {
            logger.log('info', 'Request sanity check failed.', {requestId: req.requestId});
            return;
        }
        // First verify token is ok
        const tokenResult = await verifyOpenIDToken(req);
        if (!tokenResult) {
            res.send({
                results: { user: false, room_membership: null },
                user_id: null, power_levels: null,
            });
            logger.log('info', 'User token check failed.', {requestId: req.requestId});
            return false;
        }
        // Then verify room membership
        // noinspection JSUnresolvedVariable
        const membershipResult = await verifyRoomMembership(tokenResult, req);
        if (!membershipResult) {
            res.send({
                results: { user: true, room_membership: false },
                user_id: tokenResult, power_levels: null,
            });
            logger.log('info', 'User verified but room membership check failed.', {requestId: req.requestId});
            return;
        }
        // Then get power level if available
        const powerLevelResult = await getRoomPowerLevels(tokenResult, req);
        if (!powerLevelResult) {
            logger.log('info', 'User and room membership verified, but failed to fetch power levels',
                {requestId: req.requestId});
            res.send({
                results: { user: true, room_membership: true },
                user_id: tokenResult, power_levels: null,
            });
        }
        res.send({
            results: { user: true, room_membership: true },
            user_id: tokenResult, power_levels: powerLevelResult,
        });
        logger.log('info', 'Token and room membership check out, user verified.', {requestId: req.requestId});
    },
};

module.exports = routes;
