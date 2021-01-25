const logger = require('./logger');
const matrixUtils = require('./matrixUtils');
const utils = require('./utils');

require('dotenv').config();

/**
 * Fetch power levels for a room.
 *
 * Uses Synapse admin API. Returns an object of;
 *
 * `room` - the content of the state event `m.room.power_levels` but with `users` removed
 * `user` - the power level of the user
 *
 * @param {string} userId               Matrix user ID
 * @param req                           Request object
 * @returns {Promise<object|null>}
 */
async function getRoomPowerLevels(userId, req) {
    let response;
    const homeserverUrl = process.env.UVS_HOMESERVER_URL;
    try {
        const url = `${homeserverUrl}/_synapse/admin/v1/rooms/${req.body.room_id}/state`;
        logger.log('debug', `Making request to: ${url}`, {requestId: req.requestId});
        response = await utils.axiosGet(
            url,
            null,
            {
                Authorization: `Bearer ${process.env.UVS_ACCESS_TOKEN}`,
            },
        );
    } catch (error) {
        utils.errorLogger(error, req);
        return;
    }
    if (response && response.data && response.data.state) {
        try {
            const content = response.data.state.filter(o => o.type === 'm.room.power_levels')[0].content;
            const userLevel = content.users[userId] || 0;
            delete content.users;
            return {
                room: content,
                user: userLevel,
            };
        } catch (error) {
            logger.log('warn', `Failed to find power levels in state ${req.body.room_id}`, {requestId: req.requestId});
            return;
        }
    }
    logger.log('debug', `Failed to fetch power levels for room ${req.body.room_id}`, {requestId: req.requestId});
}

function sanityCheckRequest(req, res, fields=[]) {
    if (!req.body) {
        res.status(400);

        const msg = 'Invalid request: no JSON content found in body.';
        res.send(msg);
        logger.log('warn', msg, {requestId: req.requestId});
        return false;
    }
    for (const field of fields) {
        if (
            req.body[field] === undefined ||
            req.body[field] === null ||
            (typeof req.body[field] === 'string' && req.body[field].length === 0)
        ) {
            res.status(400);
            const msg = `Invalid request: ${field} not found or with empty value in the JSON payload.`;
            logger.log('warn', msg, {requestId: req.requestId});
            res.send(msg);
            return false;
        }
    }
    logger.log('debug', 'Request sanity check ok', {requestId: req.requestId});
    return true;
}

async function verifyOpenIDToken(req) {
    let homeserver;
    let homeserverUrl;
    let response;
    if (process.env.UVS_OPENID_VERIFY_ANY_HOMESERVER === 'true') {
        try {
            homeserver = await matrixUtils.discoverHomeserverUrl(req.body.matrix_server_name);
        } catch (error) {
            logger.log('debug', `Failed to discover homeserver URL: ${error}`, {requestId: req.requestId});
            return false;
        }
        homeserverUrl = homeserver.homeserverUrl;
        if (!homeserverUrl) {
            logger.log('debug',
                'Empty or invalid homeserverUrl from discoverHomeserverUrl response',
                {requestId: req.requestId},
            );
            return false;
        }
    } else {
        homeserverUrl = process.env.UVS_HOMESERVER_URL;
    }
    try {
        const url = `${homeserverUrl}/_matrix/federation/v1/openid/userinfo`;
        logger.log('debug', `Making request to: ${url}?access_token=redacted`, {requestId: req.requestId});
        response = await utils.axiosGet(`${url}?access_token=${req.body.token}`);
    } catch (error) {
        utils.errorLogger(error, req);
        return false;
    }
    if (response && response.data && response.data.sub) {
        // If using a given Matrix server name, ensure the user ID actually matches that
        if (process.env.UVS_OPENID_VERIFY_ANY_HOMESERVER === 'true') {
            if (!response.data.sub.endsWith(`:${req.body.matrix_server_name}`)) {
                // This does not match, fail
                logger.log(
                    'warn',
                    `Matrix user ID ${response.data.sub} from OpenID userinfo lookup does not ` +
                        `match given matrix_server_name ${req.body.matrix_server_name}`,
                    {requestId: req.requestId},
                );
                return false;
            }
        }
        logger.log('debug', 'Successful token verification', {requestId: req.requestId});
        return response.data.sub;
    }
    logger.log('debug', `Failed token verification: ${utils.tryStringify(response)}`, {requestId: req.requestId});
    return false;
}

async function verifyRoomMembership(userId, req) {
    let response;
    const homeserverUrl = process.env.UVS_HOMESERVER_URL;
    try {
        const url = `${homeserverUrl}/_synapse/admin/v1/rooms/${req.body.room_id}/members`;
        logger.log('debug', `Making request to: ${url}`, {requestId: req.requestId});
        response = await utils.axiosGet(
            url,
            null,
            {
                Authorization: `Bearer ${process.env.UVS_ACCESS_TOKEN}`,
            },
        );
    } catch (error) {
        utils.errorLogger(error, req);
        return false;
    }
    if (response && response.data && response.data.members) {
        if (response.data.members.includes(userId)) {
            logger.log('debug', 'Successful room membership verification', {requestId: req.requestId});
            return true;
        } else {
            logger.log('debug', 'User is not in the room.', {requestId: req.requestId});
        }
    }
    // Don't print out response to logs - it contains the member list.
    logger.log('debug', 'Failed room membership verification.', {requestId: req.requestId});
    return false;
}

module.exports = {
    getRoomPowerLevels,
    sanityCheckRequest,
    verifyOpenIDToken,
    verifyRoomMembership,
};
