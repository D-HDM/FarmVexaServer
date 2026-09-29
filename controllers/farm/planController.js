const User = require('../../models/farm/User');
const Invoice = require('../../models/admin/Invoice');
const PendingApproval = require('../../models/admin/PendingApproval');
const Settings = require('../../models/admin/Settings');
const invoiceService = require('../../services/invoiceService');
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
        const upgradeCost = Math.max(0, planInfo.price - currentPlanPrice);

        let status = 'available';
        if (name === currentPlan) status = 'current';
        else if (currentPlan === 'Full Suite') status = 'purchased';
        else if (currentPlan === 'Pro' && (name === 'Basic' || name === 'Basic Monthly')) status = 'purchased';
        else if (currentPlan === 'Basic' && name === 'Basic Monthly') status = 'purchased';
        else if (currentPlan === 'Basic Monthly' && name === 'Basic') status = 'upgrade_available';
        else if ((currentPlan === 'Basic' || currentPlan === 'Basic Monthly') && (name === 'Pro' || name === 'Full Suite')) status = 'upgrade_available';
        else if (currentPlan === 'Pro' && name === 'Full Suite') status = 'upgrade_available';

        return {
            name,
            price: planInfo.price,
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
        } : null,
        plans,
    });
});

const submitUpgrade = asyncHandler(async (req, res) => {
    const { newPlan } = req.body;
    if (!newPlan) return errorResponse(res, 'New plan required', 400);

    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const currentPlanPrice = planPrices[user.selectedPlan]?.price || 0;
    const newPlanPrice = planPrices[newPlan]?.price || 0;

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

    // Create invoice
    let invoice;
    try {
        const result = await invoiceService.generateInvoice({
            userId: user._id,
            user,
            plan: newPlan,
            planPrice: upgradeAmount,
            planInterval: planPrices[newPlan].interval,
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
        },
    }, 'Upgrade invoice created. Please complete payment.', 201);
});

// Admin endpoints
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

    const invoice = await Invoice.findOne({
        user: user._id,
        type: 'upgrade',
        status: { $in: ['sent', 'paid'] },
    }).sort({ createdAt: -1 });

    if (invoice && invoice.status !== 'paid') {
        invoice.status = 'paid';
        invoice.amountPaid = invoice.amountDue;
        invoice.amountDue = 0;
        invoice.paidAt = new Date();
        await invoice.save();
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
    } catch (err) {
        logger.error(`Upgrade approval notification failed: ${err.message}`);
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