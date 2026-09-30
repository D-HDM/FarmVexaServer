const User = require('../../models/farm/User');
const { verifyToken } = require('../../utils/jwt');
const { errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const farmerAuth = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(res, 'Not authorized', 401);

    let decoded;
    try {
        decoded = verifyToken(token);
    } catch {
        return errorResponse(res, 'Invalid or expired token', 401);
    }

    if (decoded.role !== 'farmer' && decoded.role !== 'worker' && decoded.role !== 'vet' && decoded.role !== 'manager') {
        return errorResponse(res, 'Access denied', 403);
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return errorResponse(res, 'User not found', 404);

    if (user.approvalStatus === 'rejected') {
        return errorResponse(res, 'Account was rejected. Contact support.', 403);
    }

    if (user.approvalStatus !== 'approved') {
        return errorResponse(res, 'Account not approved yet', 403);
    }

    if (user.subscriptionExpiry && new Date() > new Date(user.subscriptionExpiry)) {
        return errorResponse(res, 'Subscription expired. Please renew to continue.', 402);
    }

    if (!user.isActive) {
        return errorResponse(res, 'Account deactivated', 403);
    }

    req.user = user;
    next();
});

module.exports = farmerAuth;