const User = require('../../models/farm/User');
const PaymentRecord = require('../../models/admin/PaymentRecord');
const PendingApproval = require('../../models/admin/PendingApproval');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const Admin = require('../../models/admin/Admin');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const getSubscriptionDetails = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return errorResponse(res, 'User not found', 404);

    const pendingRenewal = await PendingApproval.findOne({
        user: user._id,
        type: 'renewal',
        status: 'pending',
    }).lean();

    return successResponse(res, {
        plan: user.selectedPlan,
        planInterval: user.planInterval,
        planPrice: user.planPrice,
        subscriptionExpiry: user.subscriptionExpiry,
        subscriptionStatus: user.subscriptionStatus,
        lastRenewalDate: user.lastRenewalDate,
        renewalCount: user.renewalCount,
        isExpired: user.subscriptionExpiry ? new Date() > new Date(user.subscriptionExpiry) : false,
        pendingRenewal: pendingRenewal ? {
            id: pendingRenewal._id,
            submittedAt: pendingRenewal.createdAt,
            reference: pendingRenewal.paymentReference,
            amount: pendingRenewal.amount,
            paymentMethod: pendingRenewal.paymentMethod,
        } : null,
    });
});

const submitRenewal = asyncHandler(async (req, res) => {
    const { paymentMethod, paymentReference, amount } = req.body;

    if (!paymentMethod) return errorResponse(res, 'Payment method is required', 400);
    if (!paymentReference) return errorResponse(res, 'Payment reference is required', 400);

    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const existingPending = await PendingApproval.findOne({
        user: user._id,
        type: 'renewal',
        status: 'pending',
    });
    if (existingPending) {
        return errorResponse(res, 'You already have a pending renewal request', 400);
    }

    const renewalAmount = amount || user.planPrice || 500;

    const approval = await PendingApproval.create({
        user: user._id,
        type: 'renewal',
        status: 'pending',
        plan: user.selectedPlan,
        amount: renewalAmount,
        paymentMethod,
        paymentReference,
    });

    await PaymentRecord.create({
        user: user._id,
        email: user.email,
        phone: user.phone,
        amount: renewalAmount,
        plan: user.selectedPlan,
        type: 'renewal',
        reference: paymentReference,
        status: 'pending_verification',
        methodType: paymentMethod,
    });

    user.subscriptionStatus = 'pending_renewal';
    await user.save();

    // 1. Farmer — Renewal Received Email
    try {
        await emailService.send(user.email, 'farmerRenewalReceived', {
            user,
            name: user.name,
            planName: user.selectedPlan,
            amount: renewalAmount,
            paymentMethod,
            reference: paymentReference,
            previousExpiry: user.subscriptionExpiry,
        });
        logger.info(`Renewal received email sent to ${user.email}`);
    } catch (emailError) {
        logger.error(`Renewal received email failed: ${emailError.message}`);
    }

    // 2. Admin — Renewal Request Email
    try {
        const admins = await Admin.find({ isActive: true });
        for (const admin of admins) {
            await emailService.send(admin.email, 'adminRenewalRequest', {
                user: { name: admin.name, email: admin.email },
                farmer: { name: user.name, email: user.email, phone: user.phone },
                planName: user.selectedPlan,
                amount: renewalAmount,
                paymentMethod,
                reference: paymentReference,
            });
        }
        logger.info(`Renewal request email sent to admins for ${user.email}`);
    } catch (adminEmailError) {
        logger.error(`Admin renewal email failed: ${adminEmailError.message}`);
    }

    // 3. Farmer — Renewal Received SMS
    try {
        if (user.phone) {
            await smsService.send(user.phone, 'farmerRenewalReceived', {
                user,
                planName: user.selectedPlan,
                amount: renewalAmount,
            });
            logger.info(`Renewal received SMS sent to ${user.phone}`);
        }
    } catch (smsError) {
        logger.error(`Renewal SMS failed: ${smsError.message}`);
    }

    // 4. Admin — Renewal Request SMS
    try {
        const admins = await Admin.find({ isActive: true, phone: { $exists: true, $ne: '' } });
        for (const admin of admins) {
            await smsService.send(admin.phone, 'adminRenewalRequest', {
                user: { name: admin.name, phone: admin.phone },
                farmer: { name: user.name, email: user.email, phone: user.phone },
                planName: user.selectedPlan,
                amount: renewalAmount,
                reference: paymentReference,
            });
        }
        logger.info(`Renewal request SMS sent to admins for ${user.email}`);
    } catch (adminSmsError) {
        logger.error(`Admin renewal SMS failed: ${adminSmsError.message}`);
    }

    return successResponse(res, {
        approval: {
            id: approval._id,
            status: approval.status,
            plan: approval.plan,
            amount: approval.amount,
        },
    }, 'Renewal request submitted. Awaiting approval.', 201);
});

const getRenewalRequests = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const query = { type: 'renewal' };
    if (status) query.status = status;

    const renewals = await PendingApproval.find(query)
        .populate('user', 'name email phone selectedPlan subscriptionExpiry subscriptionStatus renewalCount')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const total = await PendingApproval.countDocuments(query);

    return successResponse(res, {
        renewals,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

const approveRenewal = asyncHandler(async (req, res) => {
    const approval = await PendingApproval.findById(req.params.id);
    if (!approval) return errorResponse(res, 'Renewal request not found', 404);
    if (approval.status !== 'pending') return errorResponse(res, `Request is already ${approval.status}`, 400);

    const user = await User.findById(approval.user);
    if (!user) return errorResponse(res, 'User not found', 404);

    await user.renewSubscription(30);
    user.isActive = true;
    await user.save();

    approval.status = 'approved';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.notes = req.body.notes || '';
    await approval.save();

    const payment = await PaymentRecord.findOne({ user: user._id, type: 'renewal' }).sort({ createdAt: -1 });
    if (payment) {
        payment.status = 'completed';
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = new Date();
        await payment.save();
    }

    try {
        await emailService.send(user.email, 'farmerRenewalApproved', {
            user,
            planName: user.selectedPlan,
            newExpiry: user.subscriptionExpiry,
            renewalCount: user.renewalCount,
        });
        if (user.phone) {
            await smsService.send(user.phone, 'farmerRenewalApproved', {
                user,
                planName: user.selectedPlan,
                newExpiry: user.subscriptionExpiry,
            });
        }
    } catch (notifyError) {
        logger.error(`Renewal approval notification failed: ${notifyError.message}`);
    }

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            subscriptionExpiry: user.subscriptionExpiry,
            subscriptionStatus: user.subscriptionStatus,
            renewalCount: user.renewalCount,
        },
    }, 'Renewal approved');
});

const rejectRenewal = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) return errorResponse(res, 'Rejection reason is required', 400);

    const approval = await PendingApproval.findById(req.params.id);
    if (!approval) return errorResponse(res, 'Renewal request not found', 404);
    if (approval.status !== 'pending') return errorResponse(res, `Request is already ${approval.status}`, 400);

    const user = await User.findById(approval.user);
    if (!user) return errorResponse(res, 'User not found', 404);

    approval.status = 'rejected';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = reason;
    approval.notes = req.body.notes || '';
    await approval.save();

    const payment = await PaymentRecord.findOne({ user: user._id, type: 'renewal' }).sort({ createdAt: -1 });
    if (payment) {
        payment.status = 'failed';
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = new Date();
        await payment.save();
    }

    user.subscriptionStatus = user.isSubscriptionExpired() ? 'expired' : 'active';
    await user.save();

    try {
        await emailService.send(user.email, 'farmerRenewalRejected', {
            user,
            reason,
        });
        if (user.phone) {
            await smsService.send(user.phone, 'farmerRenewalRejected', {
                user,
                reason,
            });
        }
    } catch (notifyError) {
        logger.error(`Renewal rejection notification failed: ${notifyError.message}`);
    }

    return successResponse(res, null, 'Renewal rejected');
});

module.exports = {
    getSubscriptionDetails,
    submitRenewal,
    getRenewalRequests,
    approveRenewal,
    rejectRenewal,
};