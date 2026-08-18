const isProduction = process.env.NODE_ENV === 'production';

const logger = {
    info: (message) => {
        // Allow scheduler logs in production
        if (isProduction && !message.includes('scheduler') && !message.includes('Scheduler') && !message.includes('Subscription') && !message.includes('subscription')) return;
        console.log(`[${new Date().toISOString()}] [INFO] ${message}`);
    },
    warn: (message) => {
        console.warn(`[${new Date().toISOString()}] [WARN] ${message}`);
    },
    error: (message) => {
        console.error(`[${new Date().toISOString()}] [ERROR] ${message}`);
    },
    debug: (message) => {
        // Allow scheduler debug logs in production
        if (isProduction && !message.includes('scheduler') && !message.includes('Scheduler') && !message.includes('Subscription') && !message.includes('subscription')) return;
        console.debug(`[${new Date().toISOString()}] [DEBUG] ${message}`);
    },
};

module.exports = logger;