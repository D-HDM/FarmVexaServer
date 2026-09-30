const User = require('../../models/farm/User');
const Invoice = require('../../models/admin/Invoice');
const PendingApproval = require('../../models/admin/PendingApproval');
const Settings = require('../../models/admin/Settings');
const invoiceService = require('../../services/invoiceService');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const planService = require('../../services/planService');
const { durationDaysFromInterval } = require('../../utils/planDuration');
const Admin = require('../../models/admin/Admin');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const getSubscriptionDetails = asyncHandler(async (req, res) => {
    const user = req.user;

    const pendingInvoice = await Invoice.findOne({
        user: user._id,
        type: 'renewal',
        status: { $in: ['sent', 'draft'] },
    }).sort({ createdAt: -1 }).lean();

    return successResponse(res, {
        plan: user.selectedPlan,
        planInterval: user.planInterval,
        planPrice: user.planPrice,
        subscriptionExpiry: user.subscriptionExpiry,
        subscriptionStatus: user.subscriptionStatus,
        lastRenewalDate: user.lastRenewalDate,
        renewalCount: user.renewalCount,
        isExpired: user.subscriptionExpiry ? new Date() > new Date(user.subscriptionExpiry) : false,
        invoice: pendingInvoice ? {
            id: pendingInvoice._id,
            invoiceNumber: pendingInvoice.invoiceNumber,
            amountDue: pendingInvoice.amountDue,
            currency: pendingInvoice.currency,
            dueDate: pendingInvoice.dueDate,
            status: pendingInvoice.status,
            paymentInstructions: pendingInvoice.paymentInstructions,
        } : null,
    });
});

const submitRenewal = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    if (!user.selectedPlan) {
        return errorResponse(res, 'No plan to renew', 400);
    }

    const planInfo = await planService.getByName(user.selectedPlan);
    if (!planInfo) {
        return errorResponse(res, 'Plan no longer available. Please contact support.', 400);
    }

    const existing = await Invoice.findOne({
        user: user._id,
        type: 'renewal',
        status: { $in: ['sent', 'draft'] },
    });
    if (existing) {
        return errorResponse(res, `You already have a pending renewal invoice (${existing.invoiceNumber})`, 400);
    }

    const settings = await Settings.findOne();
    const dueHours = settings?.invoice?.dueHours || 3;

    let invoice;
    try {
        const result = await invoiceService.generateInvoice({
            userId: user._id,
            user,
            plan: user.selectedPlan,
            planPrice: planInfo.price,
            planInterval: planInfo.interval,
            type: 'renewal',
        });
        invoice = result.invoice;
    } catch (err) {
        logger.error(`Renewal invoice generation failed: ${err.message}`);
        return errorResponse(res, 'Failed to generate renewal invoice', 500);
    }

    await PendingApproval.create({
        user: user._id,
        type: 'renewal',
        status: 'pending',
        plan: user.selectedPlan,
        amount: planInfo.price,
        paymentMethod: 'invoice',
        paymentReference: invoice.invoiceNumber,
    });

    user.subscriptionStatus = 'pending_renewal';
    await user.save();

    const invoiceUrl = `${process.env.CLIENT_URL}/invoice/${invoice.invoiceNumber}`;

    try {
        await emailService.send(user.email, 'farmerRenewalReceived', {
            user,
            name: user.name,
            planName: user.selectedPlan,
            amount: planInfo.price,
            invoiceNumber: invoice.invoiceNumber,
            dueDate: invoice.dueDate,
            paymentInstructions: invoice.paymentInstructions,
            previousExpiry: user.subscriptionExpiry,
            invoiceUrl,
        });
        if (user.phone) {
            await smsService.send(user.phone, 'farmerRenewalReceived', {
                user,
                planName: user.selectedPlan,
                amount: planInfo.price,
                invoiceNumber: invoice.invoiceNumber,
            });
        }
    } catch (err) {
        logger.error(`Renewal email failed: ${err.message}`);
    }

    try {
        await emailService.send(user.email, 'farmerInvoice', {
            user,
            invoiceNumber: invoice.invoiceNumber,
            amount: invoice.amountDue,
            currency: invoice.currency,
            planName: user.selectedPlan,
            dueDate: invoice.dueDate,
            paymentInstructions: invoice.paymentInstructions || [],
            invoiceUrl,
        });
        logger.info(`Renewal invoice email sent to ${user.email}`);
    } catch (err) {
        logger.error(`Renewal invoice email failed: ${err.message}`);
    }

    try {
        const admins = await Admin.find({ isActive: true });
        for (const admin of admins) {
            await emailService.send(admin.email, 'adminRenewalRequest', {
                user: { name: admin.name, email: admin.email },
                farmer: { name: user.name, email: user.email, phone: user.phone },
                planName: user.selectedPlan,
                amount: planInfo.price,
                invoiceNumber: invoice.invoiceNumber,
            });
        }
    } catch (err) {
        logger.error(`Admin renewal notification failed: ${err.message}`);
    }

    return successResponse(res, {
        invoice: {
            id: invoice._id,
            invoiceNumber: invoice.invoiceNumber,
            amountDue: invoice.amountDue,
            currency: invoice.currency,
            dueDate: invoice.dueDate,
            status: invoice.status,
            paymentInstructions: invoice.paymentInstructions,
            invoiceUrl,
        },
    }, 'Renewal invoice created. Please complete payment.', 201);
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
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
});

const approveRenewal = asyncHandler(async (req, res) => {
    const approval = await PendingApproval.findById(req.params.id);
    if (!approval) return errorResponse(res, 'Renewal request not found', 404);
    if (approval.status !== 'pending') return errorResponse(res, `Already ${approval.status}`, 400);

    const user = await User.findById(approval.user);
    if (!user) return errorResponse(res, 'User not found', 404);

    const planInfo = await planService.getByName(user.selectedPlan);
    if (!planInfo) return errorResponse(res, 'Plan no longer available', 400);

    const durationDays = durationDaysFromInterval(planInfo.interval) || 30;
    await user.renewSubscription(durationDays);
    user.isActive = true;
    await user.save();

    approval.status = 'approved';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.notes = req.body.notes || '';
    await approval.save();

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
    } catch (err) {
        logger.error(`Renewal approval notification failed: ${err.message}`);
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
    if (approval.status !== 'pending') return errorResponse(res, `Already ${approval.status}`, 400);

    approval.status = 'rejected';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = reason;
    approval.notes = req.body.notes || '';
    await approval.save();

    const user = await User.findById(approval.user);
    if (user) {
        user.subscriptionStatus = user.isSubscriptionExpired() ? 'expired' : 'active';
        await user.save();

        try {
            await emailService.send(user.email, 'farmerRenewalRejected', { user, reason });
            if (user.phone) {
                await smsService.send(user.phone, 'farmerRenewalRejected', { user, reason });
            }
        } catch (err) {
            logger.error(`Renewal rejection notification failed: ${err.message}`);
        }
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