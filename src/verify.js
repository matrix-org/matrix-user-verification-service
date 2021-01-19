const axios = require('axios');
const logger = require('./logger');
const matrixUtils = require('./matrixUtils');
const {errorLogger, tryStringify} = require('./utils');

require('dotenv').config();

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
        response = await axios.get(
            `${url}?access_token=${req.body.token}`,
            {
                timeout: 10000,
            },
        );
    } catch (error) {
        errorLogger(error, req);
        return false;
    }
    if (response && response.data && response.data.sub) {
        logger.log('debug', 'Successful token verification', {requestId: req.requestId});
        return response.data.sub;
    }
    logger.log('debug', `Failed token verification: ${tryStringify(response)}`, {requestId: req.requestId});
    return false;
}

async function verifyRoomMembership(userId, req) {
    let response;
    const homeserverUrl = process.env.UVS_HOMESERVER_URL;
    try {
        const url = `${homeserverUrl}/_synapse/admin/v1/rooms/${req.body.room_id}/members`;
        logger.log('debug', `Making request to: ${url}`, {requestId: req.requestId});
        response = await axios.get(
            url,
            {
                headers: {
                    Authorization: `Bearer ${process.env.UVS_ACCESS_TOKEN}`,
                },
            },
        );
    } catch (error) {
        errorLogger(error, req);
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
    sanityCheckRequest,
    verifyOpenIDToken,
    verifyRoomMembership,
};
