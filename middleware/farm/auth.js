const User = require('../../models/farm/User');
const { verifyToken } = require('../../utils/jwt');
const { errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const farmerAuth = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(res, 'Not authorized', 401);

    const decoded = verifyToken(token);
    if (decoded.role !== 'farmer' && decoded.role !== 'worker' && decoded.role !== 'vet' && decoded.role !== 'manager') {
        return errorResponse(res, 'Access denied', 403);
    }

    // Fetch latest user from DB (for subscription + plan)
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return errorResponse(res, 'User not found', 404);

    // Check approval
    if (user.approvalStatus !== 'approved') {
        return errorResponse(res, 'Account not approved yet', 403);
    }

    // Check subscription BEFORE isActive
    if (user.subscriptionExpiry && new Date() > new Date(user.subscriptionExpiry)) {
        user.subscriptionStatus = 'expired';
        user.isActive = false;
        await user.save();
        return errorResponse(res, 'Subscription expired. Please renew to continue.', 402);
    }

    // Check if active
    if (!user.isActive) {
        return errorResponse(res, 'Account deactivated', 403);
    }

    req.user = user;  // Full user object
    next();
});

module.exports = farmerAuth;