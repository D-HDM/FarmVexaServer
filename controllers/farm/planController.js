const User = require('../../models/farm/User');
const PaymentRecord = require('../../models/admin/PaymentRecord');
const PendingApproval = require('../../models/admin/PendingApproval');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const Admin = require('../../models/admin/Admin');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const planPrices = {
    'Basic Monthly': { price: 500, interval: 'monthly', order: 1 },
    'Basic': { price: 6000, interval: 'one_time', order: 2 },
    'Pro': { price: 10000, interval: 'one_time', order: 3 },
    'Full Suite': { price: 15000, interval: 'one_time', order: 4 },
};

const getPlans = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return errorResponse(res, 'User not found', 404);

    const currentPlan = user.selectedPlan || null;
    const currentPlanPrice = planPrices[currentPlan]?.price || 0;

    const pendingUpgrade = await PendingApproval.findOne({
        user: user._id,
        type: 'upgrade',
        status: 'pending',
    }).lean();

    const plans = Object.keys(planPrices).map((name) => {
        const planInfo = planPrices[name];
        const fullPrice = planInfo.price;
        const upgradeCost = Math.max(0, fullPrice - currentPlanPrice);

        let status = 'available';

        if (name === currentPlan) {
            status = 'current';
        } else if (currentPlan === 'Full Suite') {
            status = 'purchased';
        } else if (currentPlan === 'Pro' && (name === 'Basic' || name === 'Basic Monthly')) {
            status = 'purchased';
        } else if (currentPlan === 'Basic' && name === 'Basic Monthly') {
            status = 'purchased';
        } else if (currentPlan === 'Basic Monthly' && name === 'Basic') {
            status = 'upgrade_available';
        } else if ((currentPlan === 'Basic' || currentPlan === 'Basic Monthly') && (name === 'Pro' || name === 'Full Suite')) {
            status = 'upgrade_available';
        } else if (currentPlan === 'Pro' && name === 'Full Suite') {
            status = 'upgrade_available';
        }

        return {
            name,
            price: fullPrice,
            interval: planInfo.interval,
            order: planInfo.order,
            status,
            upgradeCost: status === 'upgrade_available' ? upgradeCost : 0,
        };
    });

    plans.sort((a, b) => a.order - b.order);

    return successResponse(res, {
        currentPlan,
        currentPlanPrice,
        pendingUpgrade: pendingUpgrade ? {
            id: pendingUpgrade._id,
            oldPlan: pendingUpgrade.oldPlan,
            newPlan: pendingUpgrade.newPlan,
            amount: pendingUpgrade.amount,
            submittedAt: pendingUpgrade.createdAt,
            paymentMethod: pendingUpgrade.paymentMethod,
            paymentReference: pendingUpgrade.paymentReference,
        } : null,
        plans,
    });
});

const submitUpgrade = asyncHandler(async (req, res) => {
    const { newPlan, paymentMethod, paymentReference } = req.body;

    if (!newPlan) return errorResponse(res, 'New plan is required', 400);
    if (!paymentMethod) return errorResponse(res, 'Payment method is required', 400);
    if (!paymentReference) return errorResponse(res, 'Payment reference is required', 400);

    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const currentPlanPrice = planPrices[user.selectedPlan]?.price || 0;
    const newPlanPrice = planPrices[newPlan]?.price || 0;

    if (newPlanPrice <= currentPlanPrice) {
        return errorResponse(res, 'Cannot upgrade to same or lower plan', 400);
    }

    const existingPending = await PendingApproval.findOne({
        user: user._id,
        type: 'upgrade',
        status: 'pending',
    });
    if (existingPending) {
        return errorResponse(res, 'You already have a pending upgrade request', 400);
    }

    const upgradeAmount = Math.max(0, newPlanPrice - currentPlanPrice);

    const approval = await PendingApproval.create({
        user: user._id,
        type: 'upgrade',
        status: 'pending',
        oldPlan: user.selectedPlan,
        newPlan,
        plan: newPlan,
        amount: upgradeAmount,
        paymentMethod,
        paymentReference,
    });

    await PaymentRecord.create({
        user: user._id,
        email: user.email,
        phone: user.phone,
        amount: upgradeAmount,
        plan: newPlan,
        type: 'upgrade',
        reference: paymentReference,
        status: 'pending_verification',
        methodType: paymentMethod,
    });

    // Farmer — Upgrade Received Email
    try {
        await emailService.send(user.email, 'farmerUpgradeReceived', {
            user,
            name: user.name,
            oldPlan: user.selectedPlan,
            newPlan,
            amount: upgradeAmount,
            paymentMethod,
            reference: paymentReference,
        });
        logger.info(`Upgrade received email sent to ${user.email}`);
    } catch (e) {
        logger.error(`Upgrade email failed: ${e.message}`);
    }

    // Admin — Upgrade Request Email
    try {
        const admins = await Admin.find({ isActive: true });
        for (const admin of admins) {
            await emailService.send(admin.email, 'adminUpgradeRequest', {
                user: { name: admin.name, email: admin.email },
                farmer: { name: user.name, email: user.email, phone: user.phone },
                oldPlan: user.selectedPlan,
                newPlan,
                amount: upgradeAmount,
                paymentMethod,
                reference: paymentReference,
            });
        }
        logger.info(`Upgrade request email sent to admins for ${user.email}`);
    } catch (e) {
        logger.error(`Admin upgrade email failed: ${e.message}`);
    }

    // Farmer — Upgrade Received SMS
    try {
        if (user.phone) {
            await smsService.send(user.phone, 'farmerUpgradeReceived', {
                user,
                oldPlan: user.selectedPlan,
                newPlan,
                amount: upgradeAmount,
            });
            logger.info(`Upgrade received SMS sent to ${user.phone}`);
        }
    } catch (e) {
        logger.error(`Upgrade SMS failed: ${e.message}`);
    }

    // Admin — Upgrade Request SMS
    try {
        const admins = await Admin.find({ isActive: true, phone: { $exists: true, $ne: '' } });
        for (const admin of admins) {
            await smsService.send(admin.phone, 'adminUpgradeRequest', {
                user: { name: admin.name, phone: admin.phone },
                farmer: { name: user.name, email: user.email, phone: user.phone },
                oldPlan: user.selectedPlan,
                newPlan,
                amount: upgradeAmount,
                reference: paymentReference,
            });
        }
        logger.info(`Upgrade request SMS sent to admins for ${user.email}`);
    } catch (e) {
        logger.error(`Admin upgrade SMS failed: ${e.message}`);
    }

    return successResponse(res, {
        approval: {
            id: approval._id,
            status: approval.status,
            oldPlan: approval.oldPlan,
            newPlan: approval.newPlan,
            amount: approval.amount,
        },
    }, 'Upgrade request submitted. Awaiting approval.', 201);
});

const getUpgradeRequests = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const query = { type: 'upgrade' };
    if (status) query.status = status;

    const upgrades = await PendingApproval.find(query)
        .populate('user', 'name email phone selectedPlan subscriptionExpiry')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const total = await PendingApproval.countDocuments(query);

    return successResponse(res, {
        upgrades,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

const approveUpgrade = asyncHandler(async (req, res) => {
    const approval = await PendingApproval.findById(req.params.id);
    if (!approval) return errorResponse(res, 'Upgrade request not found', 404);
    if (approval.status !== 'pending') return errorResponse(res, `Request is already ${approval.status}`, 400);

    const user = await User.findById(approval.user);
    if (!user) return errorResponse(res, 'User not found', 404);

    user.selectedPlan = approval.newPlan;
    user.planInterval = planPrices[approval.newPlan]?.interval || 'one_time';
    user.planPrice = planPrices[approval.newPlan]?.price || 0;
    user.subscriptionStatus = 'active';
    user.isActive = true;

    if (approval.newPlan === 'Basic Monthly') {
        user.subscriptionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    } else {
        user.subscriptionExpiry = null;
    }

    await user.save();

    approval.status = 'approved';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.notes = req.body.notes || '';
    await approval.save();

    const payment = await PaymentRecord.findOne({ user: user._id, type: 'upgrade' }).sort({ createdAt: -1 });
    if (payment) {
        payment.status = 'completed';
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = new Date();
        await payment.save();
    }

    try {
        await emailService.send(user.email, 'farmerUpgradeApproved', {
            user,
            newPlan: approval.newPlan,
        });
        if (user.phone) {
            await smsService.send(user.phone, 'farmerUpgradeApproved', {
                user,
                newPlan: approval.newPlan,
            });
        }
    } catch (e) {
        logger.error(`Upgrade approval notification failed: ${e.message}`);
    }

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            selectedPlan: user.selectedPlan,
            subscriptionStatus: user.subscriptionStatus,
        },
    }, 'Upgrade approved');
});

const rejectUpgrade = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) return errorResponse(res, 'Rejection reason is required', 400);

    const approval = await PendingApproval.findById(req.params.id);
    if (!approval) return errorResponse(res, 'Upgrade request not found', 404);
    if (approval.status !== 'pending') return errorResponse(res, `Request is already ${approval.status}`, 400);

    approval.status = 'rejected';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = reason;
    approval.notes = req.body.notes || '';
    await approval.save();

    const payment = await PaymentRecord.findOne({ user: approval.user, type: 'upgrade' }).sort({ createdAt: -1 });
    if (payment) {
        payment.status = 'failed';
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = new Date();
        await payment.save();
    }

    const user = await User.findById(approval.user);
    if (user) {
        try {
            await emailService.send(user.email, 'farmerUpgradeRejected', {
                user,
                reason,
            });
            if (user.phone) {
                await smsService.send(user.phone, 'farmerUpgradeRejected', {
                    user,
                    reason,
                });
            }
        } catch (e) {
            logger.error(`Upgrade rejection notification failed: ${e.message}`);
        }
    }

    return successResponse(res, null, 'Upgrade rejected');
});

module.exports = {
    getPlans,
    submitUpgrade,
    getUpgradeRequests,
    approveUpgrade,
    rejectUpgrade,
};