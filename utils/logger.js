const isProduction = process.env.NODE_ENV === 'production';

const logger = {
    info: (message) => {
        if (isProduction) return;
        console.log(`[${new Date().toISOString()}] [INFO] ${message}`);
    },
    warn: (message) => {
        console.warn(`[${new Date().toISOString()}] [WARN] ${message}`);
    },
    error: (message) => {
        console.error(`[${new Date().toISOString()}] [ERROR] ${message}`);
    },
    debug: (message) => {
        if (isProduction) return;
        console.debug(`[${new Date().toISOString()}] [DEBUG] ${message}`);
    },
};

module.exports = logger;