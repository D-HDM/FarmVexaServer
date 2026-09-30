const User = require('../../models/farm/User');
const Invoice = require('../../models/admin/Invoice');
const PendingApproval = require('../../models/admin/PendingApproval');
const invoiceService = require('../../services/invoiceService');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const planService = require('../../services/planService');
const { expiryFromInterval } = require('../../utils/planDuration');
const { normalizeFeatures } = require('../../utils/featureKeys');
const Admin = require('../../models/admin/Admin');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const getPlans = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return errorResponse(res, 'User not found', 404);

    const { currentPlan, currentPrice, plans } = await planService.getPlansForUser(user);

    const normalizedPlans = plans.map((p) => ({
        ...p,
        features: normalizeFeatures(p.features),
    }));

    const pendingUpgrade = await PendingApproval.findOne({
        user: user._id,
        type: 'upgrade',
        status: 'pending',
    }).lean();

    return successResponse(res, {
        currentPlan,
        currentPlanPrice: currentPrice,
        pendingUpgrade: pendingUpgrade ? {
            id: pendingUpgrade._id,
            oldPlan: pendingUpgrade.oldPlan,
            newPlan: pendingUpgrade.newPlan,
            amount: pendingUpgrade.amount,
            paymentReference: pendingUpgrade.paymentReference,
            submittedAt: pendingUpgrade.createdAt,
        } : null,
        plans: normalizedPlans,
    });
});

const submitUpgrade = asyncHandler(async (req, res) => {
    const { newPlan } = req.body;
    if (!newPlan) return errorResponse(res, 'New plan required', 400);

    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const newPlanDoc = await planService.getByName(newPlan);
    if (!newPlanDoc) return errorResponse(res, 'Invalid or disabled plan', 400);

    const currentPlanDoc = user.selectedPlan ? await planService.getByName(user.selectedPlan) : null;
    const currentPlanPrice = currentPlanDoc?.price || 0;
    const newPlanPrice = newPlanDoc.price;

    if (newPlanPrice <= currentPlanPrice) {
        return errorResponse(res, 'Cannot upgrade to same or lower plan', 400);
    }

    const existing = await PendingApproval.findOne({
        user: user._id,
        type: 'upgrade',
        status: 'pending',
    });
    if (existing) return errorResponse(res, 'You already have a pending upgrade request', 400);

    const upgradeAmount = newPlanPrice - currentPlanPrice;

    let invoice;
    try {
        const result = await invoiceService.generateInvoice({
            userId: user._id,
            user,
            plan: newPlan,
            planPrice: upgradeAmount,
            planInterval: newPlanDoc.interval,
            type: 'upgrade',
        });
        invoice = result.invoice;
    } catch (err) {
        logger.error(`Upgrade invoice generation failed: ${err.message}`);
        return errorResponse(res, 'Failed to generate upgrade invoice', 500);
    }

    await PendingApproval.create({
        user: user._id,
        type: 'upgrade',
        status: 'pending',
        oldPlan: user.selectedPlan,
        newPlan,
        plan: newPlan,
        amount: upgradeAmount,
        paymentMethod: 'invoice',
        paymentReference: invoice.invoiceNumber,
    });

    const invoiceUrl = `${process.env.CLIENT_URL}/invoice/${invoice.invoiceNumber}`;

    try {
        await emailService.send(user.email, 'farmerUpgradeReceived', {
            user,
            name: user.name,
            oldPlan: user.selectedPlan,
            newPlan,
            amount: upgradeAmount,
            invoiceNumber: invoice.invoiceNumber,
            dueDate: invoice.dueDate,
            paymentInstructions: invoice.paymentInstructions,
            invoiceUrl,
        });
        if (user.phone) {
            await smsService.send(user.phone, 'farmerUpgradeReceived', {
                user,
                oldPlan: user.selectedPlan,
                newPlan,
                amount: upgradeAmount,
                invoiceNumber: invoice.invoiceNumber,
            });
        }
    } catch (err) {
        logger.error(`Upgrade email failed: ${err.message}`);
    }

    try {
        await emailService.send(user.email, 'farmerInvoice', {
            user,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amountDue,
            currency: invoice.currency,
            planName: newPlan,
            dueDate: invoice.dueDate,
            paymentInstructions: invoice.paymentInstructions || [],
            invoiceUrl,
        });
        logger.info(`Upgrade invoice email sent to ${user.email}`);
    } catch (err) {
        logger.error(`Upgrade invoice email failed: ${err.message}`);
    }

    try {
        const admins = await Admin.find({ isActive: true });
        for (const admin of admins) {
            await emailService.send(admin.email, 'adminUpgradeRequest', {
                user: { name: admin.name, email: admin.email },
                farmer: { name: user.name, email: user.email, phone: user.phone },
                oldPlan: user.selectedPlan,
                newPlan,
                amount: upgradeAmount,
                invoiceNumber: invoice.invoiceNumber,
            });
        }
    } catch (err) {
        logger.error(`Admin upgrade notification failed: ${err.message}`);
    }

    return successResponse(res, {
        invoice: {
            id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amountDue: invoice.amountDue,
            currency: invoice.currency,
            dueDate: invoice.dueDate,
            paymentInstructions: invoice.paymentInstructions,
            invoiceUrl,
        },
    }, 'Upgrade invoice created. Please complete payment.', 201);
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
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
});

const approveUpgrade = asyncHandler(async (req, res) => {
    const approval = await PendingApproval.findById(req.params.id);
    if (!approval) return errorResponse(res, 'Upgrade request not found', 404);
    if (approval.status !== 'pending') return errorResponse(res, `Already ${approval.status}`, 400);

    const user = await User.findById(approval.user);
    if (!user) return errorResponse(res, 'User not found', 404);

    const newPlanDoc = await planService.getByName(approval.newPlan);
    if (!newPlanDoc) return errorResponse(res, 'Plan no longer available', 400);

    const now = new Date();
    const isLifetime = newPlanDoc.interval === 'one_time' || newPlanDoc.interval === 'once';

    user.selectedPlan = approval.newPlan;
    user.planInterval = newPlanDoc.interval || 'one_time';
    user.planPrice = newPlanDoc.price || 0;
    user.subscriptionStatus = 'active';
    user.isActive = true;

    if (isLifetime) {
        user.subscriptionExpiry = null;
    } else {
        const currentExpiry = user.subscriptionExpiry ? new Date(user.subscriptionExpiry) : null;
        const isFutureExpiry = currentExpiry && currentExpiry > now;
        if (!isFutureExpiry) {
            user.subscriptionExpiry = expiryFromInterval(newPlanDoc.interval, now);
        }
    }

    await user.save();

    approval.status = 'approved';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = now;
    approval.notes = req.body.notes || '';
    await approval.save();

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
    } catch (err) {
        logger.error(`Upgrade approval notification failed: ${err.message}`);
    }

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            selectedPlan: user.selectedPlan,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiry: user.subscriptionExpiry,
        },
    }, 'Upgrade approved');
});

const rejectUpgrade = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) return errorResponse(res, 'Rejection reason required', 400);

    const approval = await PendingApproval.findById(req.params.id);
    if (!approval) return errorResponse(res, 'Upgrade request not found', 404);
    if (approval.status !== 'pending') return errorResponse(res, `Already ${approval.status}`, 400);

    approval.status = 'rejected';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = reason;
    approval.notes = req.body.notes || '';
    await approval.save();

    const user = await User.findById(approval.user);
    if (user) {
        try {
            await emailService.send(user.email, 'farmerUpgradeRejected', { user, reason });
            if (user.phone) {
                await smsService.send(user.phone, 'farmerUpgradeRejected', { user, reason });
            }
        } catch (err) {
            logger.error(`Upgrade rejection notification failed: ${err.message}`);
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