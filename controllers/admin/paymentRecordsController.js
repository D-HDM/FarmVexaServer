const PaymentRecord = require('../../models/admin/PaymentRecord');
const User = require('../../models/farm/User');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const getAllPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, methodType, plan, type } = req.query;
    const query = {};

    if (status) query.status = status;
    if (methodType) query.methodType = methodType;
    if (plan) query.plan = plan;
    if (type) query.type = type;

    const payments = await PaymentRecord.find(query)
        .populate('user', 'name email phone selectedPlan subscriptionExpiry')
        .populate('verifiedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const total = await PaymentRecord.countDocuments(query);

    const totalAmount = await PaymentRecord.aggregate([
        { $match: { status: { $in: ['completed', 'pending_verification'] } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);

    const pendingCount = await PaymentRecord.countDocuments({ status: 'pending_verification' });
    const completedCount = await PaymentRecord.countDocuments({ status: 'completed' });
    const failedCount = await PaymentRecord.countDocuments({ status: 'failed' });

    return successResponse(res, {
        payments,
        stats: {
            totalAmount: totalAmount[0]?.sum || 0,
            pendingCount,
            completedCount,
            failedCount,
            totalCount: total,
        },
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

const getPaymentById = asyncHandler(async (req, res) => {
    const payment = await PaymentRecord.findById(req.params.id)
        .populate('user', 'name email phone county subCounty selectedPlan planInterval planPrice subscriptionExpiry subscriptionStatus')
        .populate('verifiedBy', 'name email')
        .lean();

    if (!payment) return errorResponse(res, 'Payment not found', 404);
    return successResponse(res, { payment });
});

const verifyPayment = asyncHandler(async (req, res) => {
    const payment = await PaymentRecord.findById(req.params.id);
    if (!payment) return errorResponse(res, 'Payment not found', 404);

    payment.status = 'completed';
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = new Date();
    await payment.save();

    // Update user
    if (payment.user) {
        const user = await User.findById(payment.user);
        if (user) {
            user.paymentStatus = 'paid';

            // If registration and monthly plan → activate subscription
            if (payment.type === 'registration' && user.planInterval === 'monthly') {
                user.subscriptionStartDate = new Date();
                user.subscriptionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                user.subscriptionStatus = 'active';
                user.isActive = true;
                user.approvalStatus = 'approved';
            }

            // If renewal → extend subscription
            if (payment.type === 'renewal') {
                await user.renewSubscription(30);
            }

            await user.save();
        }
    }

    logger.info(`Payment ${payment._id} verified by admin ${req.user.id}`);
    return successResponse(res, { payment }, 'Payment verified');
});

const rejectPayment = asyncHandler(async (req, res) => {
    const payment = await PaymentRecord.findById(req.params.id);
    if (!payment) return errorResponse(res, 'Payment not found', 404);

    payment.status = 'failed';
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = new Date();
    await payment.save();

    // Update user
    if (payment.user) {
        const user = await User.findById(payment.user);
        if (user) {
            user.paymentStatus = 'failed';
            if (payment.type === 'renewal') {
                user.subscriptionStatus = user.isSubscriptionExpired() ? 'expired' : 'active';
            }
            await user.save();
        }
    }

    return successResponse(res, { payment }, 'Payment rejected');
});

const getPaymentStats = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await PaymentRecord.countDocuments({ createdAt: { $gte: today } });
    const todayAmount = await PaymentRecord.aggregate([
        { $match: { createdAt: { $gte: today }, status: { $in: ['completed', 'pending_verification'] } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);

    const byPlan = await PaymentRecord.aggregate([
        { $match: { status: { $in: ['completed', 'pending_verification'] } } },
        { $group: { _id: '$plan', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]);

    const byMethod = await PaymentRecord.aggregate([
        { $group: { _id: '$methodType', count: { $sum: 1 } } },
    ]);

    const byType = await PaymentRecord.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]);

    return successResponse(res, {
        today: {
            count: todayCount,
            amount: todayAmount[0]?.sum || 0,
        },
        byPlan,
        byMethod,
        byType,
    });
});

module.exports = {
    getAllPayments,
    getPaymentById,
    verifyPayment,
    rejectPayment,
    getPaymentStats,
};