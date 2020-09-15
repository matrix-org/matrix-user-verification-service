const axios = require('axios');
const logger = require('./logger');
const {errorLogger, tryStringify} = require('./utils');

require('dotenv').config();

const homeserverUrl = process.env.UVS_HOMESERVER_URL;

function sanityCheckRequest(req, res, fields=[]) {
    if (!req.body) {
        res.status(400);

        const msg = 'Invalid request: no JSON content found in body.';
        res.send(msg);
        logger.log('warn', msg);
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
            logger.log('warn', msg);
            res.send(msg);
            return false;
        }
    }
    logger.log('debug', 'Request sanity check ok');
    return true;
}

async function verifyOpenIDToken(token) {
    let response;
    try {
        const url = `${homeserverUrl}/_matrix/federation/v1/openid/userinfo`;
        logger.log('debug', `Making request to: ${url}?access_token=redacted`);
        response = await axios.get(`${url}?access_token=${token}`);
    } catch (error) {
        errorLogger(error);
        return false;
    }
    if (response && response.data && response.data.sub) {
        logger.log('debug', 'Successful token verification');
        return response.data.sub;
    }
    logger.log('debug', `Failed token verification: ${tryStringify(response)}`);
    return false;
}

async function verifyRoomMembership(userId, roomId) {
    let response;
    try {
        const url = `${homeserverUrl}/_synapse/admin/v1/rooms/${roomId}/members`;
        logger.log('debug', `Making request to: ${url}`);
        response = await axios.get(
            url,
            {
                headers: {
                    Authorization: `Bearer ${process.env.UVS_ACCESS_TOKEN}`,
                },
            },
        );
    } catch (error) {
        errorLogger(error);
        return false;
    }
    if (response && response.data && response.data.members) {
        if (response.data.members.includes(userId)) {
            logger.log('debug', 'Successful room membership verification');
            return true;
        } else {
            logger.log('debug', 'User is not in the room.');
        }
    }
    // Don't print out response to logs - it contains the member list.
    logger.log('debug', 'Failed room membership verification.');
    return false;
}

module.exports = {
    sanityCheckRequest,
    verifyOpenIDToken,
    verifyRoomMembership,
};
