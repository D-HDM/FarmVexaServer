const User = require('../../models/farm/User');
const Invoice = require('../../models/admin/Invoice');
const { verifyToken } = require('../../utils/jwt');
const { errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const scopedAuth = asyncHandler(async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return errorResponse(res, 'Not authorized', 401);

    let decoded;
    try {
        decoded = verifyToken(token);
    } catch {
        return errorResponse(res, 'Invalid or expired token', 401);
    }

    const user = await User.findById(decoded.id).select('-password');
    if (!user) return errorResponse(res, 'User not found', 404);

    let scope = 'active';
    if (user.approvalStatus === 'pending') scope = 'pending';
    if (user.approvalStatus === 'rejected') scope = 'rejected';
    if (user.subscriptionExpiry && new Date() > new Date(user.subscriptionExpiry)) scope = 'expired';

    let invoice = null;
    if (scope === 'pending' || scope === 'expired' || user.paymentStatus !== 'paid') {
        invoice = await Invoice.findOne({ user: user._id })
            .sort({ createdAt: -1 })
            .lean();
    }

    req.user = user;
    req.scope = scope;
    req.invoice = invoice;
    next();
});

module.exports = scopedAuth;