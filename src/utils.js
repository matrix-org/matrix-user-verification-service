const uuidv4 = require('uuid').v4;
const logger = require('./logger');

/**
 * Authenticate the request, if auth configured.
 *
 * If UVS_AUTH_TOKEN is set, we'll require that
 * in a bearer token authorization header.
 *
 * Updates the response and returns false on rejection.
 *
 * @param req               Request
 * @param res               Response
 * @return {boolean}        false if auth failed
 */
function authenticateRequest(req, res) {
    if (!process.env.UVS_AUTH_TOKEN) {
        return true;
    }

    const authorization = req.header('Authorization');
    if (!authorization) {
        res.status(403);
        res.send({});
        logger.log('warn', 'No authorization header found.', {requestId: req.requestId});
        return false;
    }
    try {
        const parts = authorization.split(' ');
        const result = parts[0] === 'Bearer' && parts[1] === process.env.UVS_AUTH_TOKEN;
        if (result) {
            return true;
        }
    } catch (error) {
        logger.log('warn', 'Failed to parse authentication header.', {requestId: req.requestId});
        res.status(403);
        res.send({});
        return false;
    }
    logger.log('warn', 'Invalid Authorization header or wrong token.', {requestId: req.requestId});
    res.status(403);
    res.send({});
    return false;
}

function tryStringify(obj) {
    try {
        return JSON.stringify(obj);
    } catch (error) {
        return obj;
    }
}

function errorLogger(error, req) {
    if (error.response) {
        const response = error.response;
        if (response.headers.authorization) {
            // Redact token from logs
            response.headers.authorization = 'Bearer <redacted>';
        }
        logger.log(
            'debug',
            `Verify token failed: ${response.status}, ${tryStringify(response.headers)}, ${tryStringify(response.data)}`,
            {requestId: req.requestId},
        );
    } else if (error.request) {
        logger.log('error', `No response received: ${tryStringify(error.request)}`, {requestId: req.requestId});
    } else {
        logger.log('error', `Failed to make verify request: ${error.message}`, {requestId: req.requestId});
    }
}

function requestLogger(req) {
    if (!req.requestId) {
        req.requestId = uuidv4();
    }
    if (req.method === 'POST') {
        // Ensure we don't log the token
        const loggedBody = Object.assign({}, req.body, {token: '<redacted>'});
        logger.log('info', `${req.method} ${req.path}: ${tryStringify(loggedBody)}`, {requestId: req.requestId});
    } else {
        logger.log('info', `${req.method} ${req.path}`,{requestId: req.requestId});
    }
}

module.exports = {
    authenticateRequest,
    errorLogger,
    requestLogger,
    tryStringify,
};
