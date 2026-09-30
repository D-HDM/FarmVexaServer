const Payment = require('../../models/admin/Payment');
const Invoice = require('../../models/admin/Invoice');
const User = require('../../models/farm/User');
const mpesaService = require('../../services/mpesaService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

/* ============ LIST PAYMENTS ============ */
const getAllPayments = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, method, purpose, type } = req.query;
    const query = {};

    if (status) query.status = status;
    if (method) query.method = method;
    if (purpose) query.purpose = purpose;
    if (type) query.purpose = type;

    const payments = await Payment.find(query)
        .populate('user', 'name email phone selectedPlan subscriptionExpiry')
        .populate('invoice', 'invoiceNumber amountPaid amountDue currency status')
        .populate('verifiedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const total = await Payment.countDocuments(query);

    const totalAmount = await Payment.aggregate([
        { $match: { status: { $in: ['success', 'pending'] } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);

    const pendingCount = await Payment.countDocuments({ status: 'pending' });
    const completedCount = await Payment.countDocuments({ status: 'success' });
    const failedCount = await Payment.countDocuments({ status: 'failed' });

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

/* ============ GET PAYMENT ============ */
const getPaymentById = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id)
        .populate('user', 'name email phone county subCounty selectedPlan planInterval planPrice subscriptionExpiry subscriptionStatus paymentStatus')
        .populate('invoice', 'invoiceNumber amountPaid amountDue currency status paidAt')
        .populate('verifiedBy', 'name email')
        .lean();

    if (!payment) return errorResponse(res, 'Payment not found', 404);
    return successResponse(res, { payment });
});

/* ============ VERIFY PAYMENT (queries Safaricom first) ============ */
const verifyPayment = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return errorResponse(res, 'Payment not found', 404);

    if (payment.status === 'success') {
        return errorResponse(res, 'Payment already verified', 400);
    }

    if (!payment.checkoutRequestId) {
        return errorResponse(res, 'Payment has no checkoutRequestId to query', 400);
    }

    const query = await mpesaService.querySTKStatus(payment.checkoutRequestId);

    if (!query.success) {
        return errorResponse(
            res,
            query.error?.errorMessage || 'Failed to query Safaricom',
            502
        );
    }

    const resultCode = String(query.resultCode);
    const now = new Date();

    if (resultCode !== '0') {
        payment.status = 'failed';
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = now;
        payment.providerPayload = {
            ...(payment.providerPayload || {}),
            manualVerifyQuery: query,
        };
        await payment.save();

        return errorResponse(
            res,
            `Safaricom reports: ${query.resultDesc} (code ${resultCode})`,
            400
        );
    }

    payment.status = 'success';
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = now;
    payment.providerPayload = {
        ...(payment.providerPayload || {}),
        manualVerifyQuery: query,
    };
    await payment.save();

    if (payment.invoice) {
        const invoice = await Invoice.findById(payment.invoice);
        if (invoice && invoice.status !== 'paid') {
            invoice.status = 'paid';
            invoice.amountPaid = invoice.total;
            invoice.amountDue = 0;
            invoice.paidAt = now;
            invoice.paymentMethod = payment.method;
            invoice.paymentRef = payment.mpesaReceipt || payment.providerRef || null;
            await invoice.save();
        }
    }

    if (payment.user) {
        const user = await User.findById(payment.user);
        if (user) {
            user.paymentStatus = 'paid';
            user.paymentMethod = payment.method;
            user.paymentReference = payment.mpesaReceipt || payment.providerRef || null;
            user.paymentDate = now;
            await user.save();
        }
    }

    logger.info(`Payment ${payment._id} verified against Safaricom by admin ${req.user.id}`);
    return successResponse(res, { payment, safaricom: query }, 'Payment verified');
});

/* ============ REJECT PAYMENT ============ */
const rejectPayment = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return errorResponse(res, 'Payment not found', 404);

    const now = new Date();

    payment.status = 'failed';
    payment.verifiedBy = req.user.id;
    payment.verifiedAt = now;
    await payment.save();

    if (payment.user) {
        const user = await User.findById(payment.user);
        if (user) {
            user.paymentStatus = 'failed';
            if (payment.purpose === 'renewal') {
                user.subscriptionStatus = user.isSubscriptionExpired() ? 'expired' : 'active';
            }
            await user.save();
        }
    }

    logger.info(`Payment ${payment._id} rejected by admin ${req.user.id}`);
    return successResponse(res, { payment }, 'Payment rejected');
});

/* ============ STATS ============ */
const getPaymentStats = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await Payment.countDocuments({ createdAt: { $gte: today } });
    const todayAmount = await Payment.aggregate([
        { $match: { createdAt: { $gte: today }, status: { $in: ['success', 'pending'] } } },
        { $group: { _id: null, sum: { $sum: '$amount' } } },
    ]);

    const byPurpose = await Payment.aggregate([
        { $match: { status: { $in: ['success', 'pending'] } } },
        { $group: { _id: '$purpose', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]);

    const byMethod = await Payment.aggregate([
        { $group: { _id: '$method', count: { $sum: 1 } } },
    ]);

    const byStatus = await Payment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return successResponse(res, {
        today: {
            count: todayCount,
            amount: todayAmount[0]?.sum || 0,
        },
        byPurpose,
        byMethod,
        byStatus,
    });
});

module.exports = {
    getAllPayments,
    getPaymentById,
    verifyPayment,
    rejectPayment,
    getPaymentStats,
};