const logger = require('./logger');

function errorLogger(error) {
    if (error.response) {
        const response = error.response;
        if (response.headers.authorization) {
            // Redact token from logs
            response.headers.authorization = 'Bearer <redacted>';
        }
        logger.log(
            'debug',
            `Verify token failed: ${response.status}, ${stringify(response.headers)}, ${stringify(response.data)}`,
        );
    } else if (error.request) {
        logger.log('error', `No response received: ${stringify(error.request)}`);
    } else {
        logger.log('error', `Failed to make verify request: ${error.message}`);
    }
}

function requestLogger(req) {
    if (req.method === 'POST') {
        logger.log('info', `${req.method} ${req.path}: ${stringify(req.body)}`);
    } else {
        logger.log('info', `${req.method} ${req.path}`);
    }
}

function stringify(obj) {
    try {
        return JSON.stringify(obj);
    } catch (error) {
        return obj;
    }
}

module.exports = {
    errorLogger,
    requestLogger,
    stringify,
};
