const User = require('../../models/farm/User');
const { verifyToken } = require('../../utils/jwt');
const { errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const renewalAuth = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(res, 'Not authorized', 401);

    const decoded = verifyToken(token);
    if (decoded.role !== 'farmer') {
        return errorResponse(res, 'Access denied', 403);
    }

    // Fetch user — NO approval/isActive/subscription check
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return errorResponse(res, 'User not found', 404);

    req.user = user;
    next();
});

module.exports = renewalAuth;