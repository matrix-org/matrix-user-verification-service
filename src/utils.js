const logger = require('./logger');

function tryStringify(obj) {
    try {
        return JSON.stringify(obj);
    } catch (error) {
        return obj;
    }
}

function errorLogger(error) {
    if (error.response) {
        const response = error.response;
        if (response.headers.authorization) {
            // Redact token from logs
            response.headers.authorization = 'Bearer <redacted>';
        }
        logger.log(
            'debug',
            `Verify token failed: ${response.status}, ${tryStringify(response.headers)}, ${tryStringify(response.data)}`,
        );
    } else if (error.request) {
        logger.log('error', `No response received: ${tryStringify(error.request)}`);
    } else {
        logger.log('error', `Failed to make verify request: ${error.message}`);
    }
}

function requestLogger(req) {
    if (req.method === 'POST') {
        logger.log('info', `${req.method} ${req.path}: ${tryStringify(req.body)}`);
    } else {
        logger.log('info', `${req.method} ${req.path}`);
    }
}

module.exports = {
    errorLogger,
    requestLogger,
    tryStringify,
};
