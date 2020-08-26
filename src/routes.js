const {
    sanityCheckRequest,
    verifyOpenIDToken,
    verifyRoomMembership,
} = require('./verify');

const routes = {
    getHealth: (req, res) => {
        res.send('👍');
    },
    postVerifyUser: async(req, res) => {
        const checkResult = sanityCheckRequest(req, res, ['token']);
        if (!checkResult) {
            return;
        }
        const tokenResult = await verifyOpenIDToken(req.body.token);
        if (!tokenResult) {
            res.send({
                results: { user: false },
                user_id: null,
            });
            return false;
        }
        res.send({
            results: { user: true },
            user_id: tokenResult,
        });
    },
    postVerifyUserInRoom: async(req, res) => {
        const checkResult = sanityCheckRequest(req, res, ['token', 'room_id']);
        if (!checkResult) {
            return;
        }
        const tokenResult = await verifyOpenIDToken(req.body.token);
        if (!tokenResult) {
            res.send({
                results: { user: false, room_membership: null },
                user_id: null,
            });
            return false;
        }
        // noinspection JSUnresolvedVariable
        const membershipResult = await verifyRoomMembership(tokenResult, req.body.room_id);
        if (!membershipResult) {
            res.send({
                results: { user: true, room_membership: false },
                user_id: tokenResult,
            });
            return;
        }
        res.send({
            results: { user: true, room_membership: true },
            user_id: tokenResult,
        });
    },
};

module.exports = routes;
