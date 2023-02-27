const axios = require('axios');
const dnsUtils = require('./dnsUtils');
const ipRangeCheck = require('ip-range-check');
const logger = require('./logger');
const net = require('net');
const uuidv4 = require('uuid').v4;

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
        let loggedBody = Object.assign({}, req.body);
        if (loggedBody.token) {
            // Ensure we don't log the token
            loggedBody.token = '<redacted>';
        }
        logger.log('info', `${req.method} ${req.path}: ${tryStringify(loggedBody)}`, {requestId: req.requestId});
    } else {
        logger.log('info', `${req.method} ${req.path}`,{requestId: req.requestId});
    }
}

const ip4RangeBlacklist = [
    '127.0.0.0/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '100.64.0.0/10',
    '192.0.0.0/24',
    '169.254.0.0/16',
    '198.18.0.0/15',
    '192.0.2.0/24',
    '198.51.100.0/24',
    '203.0.113.0/24',
    '224.0.0.0/4',
];

const ip6RangeBlacklist = [
    '::1/128',
    'fe80::/10',
    'fc00::/7',
    'fec0::/10',
];

const ipRangeBlacklist = [
    ...ip4RangeBlacklist,
    ...ip6RangeBlacklist,
];

/**
 * Check if adresses are blacklisted via IP ranges.
 *
 * @param {array} addresses             Adresses to check
 * @returns {boolean}                   true if blacklisted
 */
function isBlacklisted(addresses) {
    return Array.from(addresses).some(a => ipRangeCheck(a, ipRangeBlacklist));
}

/**
 * Resolve a domain.
 *
 * @param {string} domain           Domain to resolve
 * @returns {array}                 The adresses resolved from the domain
 */
 async function resolveDomain(domain) {
    if (!net.isIP(domain)) {
        try {
            return await dnsUtils.resolve(domain);
        } catch (error) {
            return [];
        }
    } else {
        return [domain];
    }
}

/**
 * Wrapped Axios GET.
 *
 * Check all requests, including the redirects against our blacklist.
 * Also implements some other sane defaults like timeouts.
 *
 * @param {string} url                          URL to call
 * @param {number|null} haveRedirectedTimes     Counter how many times we've redirected already
 * @param {object|null} headers                 Extra headers to use
 * @param {boolean} checkBlacklist              Check if hostname of URL is on blaclist
 * @returns {Promise<object>}                   Response object
 * @throws                                      On non-20x response (after redirects) or a blacklisted domain
 */
async function axiosGet(url, haveRedirectedTimes = null, headers = null, disableBlacklistCheck = false) {
    let redirects = haveRedirectedTimes;
    if (!redirects) {
        redirects = 0;
    }
    const urlObj = new URL(url);

    if (!disableBlacklistCheck && isBlacklisted(await resolveDomain(urlObj.hostname))) {
        throw new Error(`Refusing to call blacklisted hostname ${urlObj.hostname}`);
    }
    const response = await axios.get(
        url,
        {
            headers,
            maxRedirects: 0,
            timeout: 10000,
            validateStatus: function (status) {
                // Include redirects as OK here, since we control that separately
                return status >= 200 && status < 400;
            },
        },
    );
    if (response.status >= 300) {
        if (redirects >= 4) {
            // This was the fourth time following a redirect, abort
            throw new Error('Maximum amount of redirects reached.');
        }
        return axiosGet(response.headers.location, redirects + 1, headers);
    }
    return response;
}


module.exports = {
    authenticateRequest,
    axiosGet,
    errorLogger,
    isBlacklisted,
    requestLogger,
    resolveDomain,
    tryStringify,
};
