const axios = require('axios');

require('dotenv').config();

const homeserverUrl = process.env.VERIFY_BOT_HOMESERVER_URL;

function sanityCheckRequest(req, res, fields=[]) {
    if (!req.body) {
        res.status(400);
        res.send('Invalid request: no JSON content found in body.');
        return false;
    }
    for (const field of fields) {
        if (
            req.body[field] === undefined ||
            req.body[field] === null ||
            (typeof req.body[field] === 'string' && req.body[field].length === 0)
        ) {
            res.status(400);
            res.send(`Invalid request: ${field} not found or with empty value in the JSON payload.`);
            return false;
        }
    }
    return true;
}

async function verifyOpenIDToken(token) {
    let response;
    try {
        response = await axios.get(
            `${homeserverUrl}/_matrix/federation/v1/openid/userinfo?access_token=${token}`,
        );
    } catch (error) {
        return false;
    }
    if (response && response.data && response.data.sub) {
        return response.data.sub;
    }
    return false;
}

async function verifyRoomMembership(userId, roomId) {
    let response;
    try {
        response = await axios.get(
            `${homeserverUrl}/_synapse/admin/v1/rooms/${roomId}/members`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.VERIFY_BOT_ACCESS_TOKEN}`,
                },
            },
        );
    } catch (error) {
        return false;
    }
    if (response && response.data && response.data.members) {
        if (response.data.members.includes(userId)) {
            return true;
        }
    }
    return false;
}

module.exports = {
    sanityCheckRequest,
    verifyOpenIDToken,
    verifyRoomMembership,
};
