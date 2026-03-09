const express = require('express');
const routes = require('./routes');
const logger = require('./logger');


const app = express();
const listenAddress = process.env.UVS_LISTEN_ADDRESS || '127.0.0.1';
const port = process.env.UVS_PORT || 3000;

app.use(express.json());

// noinspection JSCheckFunctionSignatures
app.get('/health', routes.getHealth);

// noinspection JSCheckFunctionSignatures
app.post('/verify/user', routes.postVerifyUser);

// noinspection JSCheckFunctionSignatures
app.post('/verify/user_in_room', routes.postVerifyUserInRoom);

logger.log('info', `Attempting to listen on ${listenAddress}:${port}`);

const server = app.listen(port, listenAddress, () => {
    logger.log('info', `Verify user service listening at ${listenAddress}:${port}`);
});

// Graceful shutdown handler
const shutdown = (signal) => {
    logger.log('info', `Received ${signal}, shutting down gracefully...`);
    server.close(() => {
        logger.log('info', 'Server closed');
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
