const { verifyToken } = require('../../utils/jwt');
const { errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const adminAuth = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return errorResponse(res, 'Not authorized', 401);
    }

    const decoded = verifyToken(token);

    if (decoded.role !== 'super_admin' && decoded.role !== 'admin') {
        return errorResponse(res, 'Admin access required', 403);
    }

    req.user = decoded;
    next();
});

module.exports = adminAuth;