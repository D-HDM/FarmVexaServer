const { errorResponse } = require('../../utils/response');
const logger = require('../../utils/logger');

const errorHandler = (err, req, res, next) => {
    logger.error(err.message);

    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map((e) => e.message);
        return errorResponse(res, messages.join(', '), 400);
    }

    if (err.name === 'CastError') {
        return errorResponse(res, 'Invalid ID format', 400);
    }

    if (err.code === 11000) {
        return errorResponse(res, 'Duplicate field value', 400);
    }

    if (err.name === 'JsonWebTokenError') {
        return errorResponse(res, 'Invalid token', 401);
    }

    if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Token expired', 401);
    }

    const statusCode = err.statusCode || 500;
    return errorResponse(res, err.message || 'Server Error', statusCode);
};

module.exports = errorHandler;