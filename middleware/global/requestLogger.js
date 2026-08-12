const logger = require('../../utils/logger');

const requestLogger = (req, res, next) => {
    const start = Date.now();

    if (req.url.startsWith('/socket.io') || req.url.startsWith('/uploads')) {
        return next();
    }

    res.on('finish', () => {
        const duration = Date.now() - start;
        const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
        if (res.statusCode >= 400) {
            logger.warn(msg);
        } else {
            logger.info(msg);
        }
    });

    next();
};

module.exports = requestLogger;