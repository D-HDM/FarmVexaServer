const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // 10000 requests per 15 minutes
    message: {
        success: false,
        message: 'Too many requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // 100 login attempts per 15 minutes
    message: {
        success: false,
        message: 'Too many login attempts. Please try again later.',
    },
});

module.exports = { generalLimiter, authLimiter };