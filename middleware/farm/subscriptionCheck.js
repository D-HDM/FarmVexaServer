const { errorResponse } = require('../../utils/response');

const subscriptionCheck = async (req, res, next) => {
    const user = req.user;

    // No subscription expiry = one-time plan (lifetime)
    if (!user.subscriptionExpiry) return next();

    // Check if expired
    if (new Date() > new Date(user.subscriptionExpiry)) {
        user.subscriptionStatus = 'expired';
        await user.save();
        return errorResponse(res, 'Subscription expired. Please renew to continue.', 402);
    }

    next();
};

module.exports = subscriptionCheck;