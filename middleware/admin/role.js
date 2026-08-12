const { errorResponse } = require('../../utils/response');

const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return errorResponse(res, 'Insufficient permissions', 403);
        }
        next();
    };
};

module.exports = { requireRole };