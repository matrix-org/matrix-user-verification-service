const uuidv4 = require('uuid').v4;
const logger = require('./logger');

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
    errorLogger,
    requestLogger,
    tryStringify,
};
