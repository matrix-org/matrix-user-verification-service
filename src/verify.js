const logger = require('./logger');
const matrixUtils = require('./matrixUtils');
const utils = require('./utils');

/**
 * Whether the user is a creator of a room whose version gives creators their power implicitly.
 *
 * From room version 12 (and its test version org.matrix.hydra.11) the sender of `m.room.create`
 * and the users in its `additional_creators` have unlimited power and must not be listed in
 * `m.room.power_levels`, so a lookup in `users` alone sees them at `users_default`.
 *
 * @param {object[]} state              Room state events from the Synapse admin API
 * @param {string} userId               Matrix user ID
 * @returns {boolean}
 */
function isRoomCreator(state, userId) {
    const create = state.find(o => o.type === 'm.room.create' && o.state_key === '');
    if (!create || !create.content) {
        return false;
    }
    const version = String(create.content.room_version || '1');
    if (version !== 'org.matrix.hydra.11' && !(/^\d+$/.test(version) && Number(version) >= 12)) {
        return false;
    }
    const additional = Array.isArray(create.content.additional_creators) ? create.content.additional_creators : [];
    return create.sender === userId || additional.includes(userId);
}

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
            }
        );
    } catch (error) {
        utils.errorLogger(error, req);
        return;
    }
    if (response && response.data && response.data.state) {
        try {
            const content = response.data.state.filter(o => o.type === 'm.room.power_levels')[0].content;
            let userLevel = content.users[userId];
            if (!Number.isFinite(userLevel)) {
                userLevel = content.users_default || 0;
            }
            if (isRoomCreator(response.data.state, userId)) {
                userLevel = Number.MAX_SAFE_INTEGER;
            }
            delete content.users;
            return {
                room: content,
                user: userLevel,
            };
        } catch (error) {
            logger.log('warn', `Failed to find power levels in state ${req.body.room_id}`, {requestId: req.requestId}, error);
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
    let response;
    let serverName;
    if (process.env.UVS_OPENID_VERIFY_SERVER_NAME) {
        if (req.body.matrix_server_name !== process.env.UVS_OPENID_VERIFY_SERVER_NAME) {
            // Refuse to check token against any other servers
            logger.log(
                'warn',
                'Refusing to check token which is not for the server we have configured: ' +
                    req.body.matrix_server_name,
            );
            return false;
        }
        serverName = process.env.UVS_OPENID_VERIFY_SERVER_NAME;
    } else {
        serverName = req.body.matrix_server_name;
    }
    try {
        homeserver = await matrixUtils.discoverHomeserverUrl(serverName);
    } catch (error) {
        logger.log('warn', `Failed to discover homeserver URL: ${error}`, {requestId: req.requestId});
        return false;
    }
    if (!homeserver.homeserverUrl) {
        logger.log('warn',
            'Empty or invalid homeserverUrl from discoverHomeserverUrl response',
            {requestId: req.requestId},
        );
        return false;
    }
    try {
        const url = `${homeserver.homeserverUrl}/_matrix/federation/v1/openid/userinfo`;
        logger.log('debug', `Making request to: ${url}?access_token=redacted`, {requestId: req.requestId});
        response = await utils.axiosGet(
            `${url}?access_token=${req.body.token}`,
            null,
            {
                Host: homeserver.serverName,
            },
        );
    } catch (error) {
        utils.errorLogger(error, req);
        return false;
    }
    if (response && response.data && response.data.sub) {
        // Ensure the user ID actually matches the server name we checked against
        if (typeof response.data.sub !== 'string' || !response.data.sub.endsWith(`:${serverName}`)) {
            // This does not match, fail
            logger.log(
                'warn',
                `Matrix user ID ${response.data.sub} from OpenID userinfo lookup does not ` +
                    `match given matrix_server_name ${serverName}`,
                {requestId: req.requestId},
            );
            return false;
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
            }
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
