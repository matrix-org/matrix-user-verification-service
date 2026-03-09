const winston = require('winston');
const { combine, timestamp, prettyPrint, json, logstash } = winston.format;

const logFormat = process.env.UVS_LOG_FORMAT || 'json';

const formats = {
    'json': combine(timestamp(), json()),
    'json-logstash': combine(timestamp(), logstash()),
    'pretty': combine(timestamp(), prettyPrint()),
};

const format = formats[logFormat] || formats['json'];

winston.configure({
    format,
    transports: [
        new winston.transports.Console({
            level: process.env.UVS_LOG_LEVEL || 'info',
        }),
    ],
});

module.exports = winston;
