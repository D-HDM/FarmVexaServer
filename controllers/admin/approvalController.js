const User = require('../../models/farm/User');
const PendingApproval = require('../../models/admin/PendingApproval');
const Invoice = require('../../models/admin/Invoice');
const Payment = require('../../models/admin/Payment');
const Admin = require('../../models/admin/Admin');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const planService = require('../../services/planService');
const { expiryFromInterval } = require('../../utils/planDuration');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

/* ============ LIST PENDING APPROVALS ============ */
const getPendingApprovals = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const query = { status: 'pending', type: 'registration' };

    const approvals = await PendingApproval.find(query)
        .populate('user', 'name email phone county subCounty createdAt selectedPlan planInterval planPrice paymentStatus paymentMethod paymentReference')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const approvalsWithPayment = await Promise.all(
        approvals.map(async (approval) => {
            const invoice = await Invoice.findOne({ user: approval.user?._id })
                .sort({ createdAt: -1 })
                .lean();
            const payment = await Payment.findOne({ user: approval.user?._id })
                .sort({ createdAt: -1 })
                .lean();
            return { ...approval, invoice, payment };
        })
    );

    const total = await PendingApproval.countDocuments(query);

    return successResponse(res, {
        approvals: approvalsWithPayment,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

/* ============ APPROVE USER ============ */
const approveUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);
    if (user.approvalStatus !== 'pending') {
        return errorResponse(res, `User is already ${user.approvalStatus}`, 400);
    }

    const planInfo = await planService.getByName(user.selectedPlan);
    if (!planInfo) return errorResponse(res, 'Plan no longer available', 400);

    const now = new Date();
    const expiry = expiryFromInterval(planInfo.interval, now);

    user.approvalStatus = 'approved';
    user.isActive = true;
    user.approvedBy = req.user.id;
    user.approvedAt = now;
    user.rejectionReason = undefined;

    user.subscriptionStartDate = now;
    user.subscriptionExpiry = expiry;
    user.subscriptionStatus = 'active';

    await user.save();

    let approval = await PendingApproval.findOne({ user: user._id, type: 'registration' });
    if (!approval) approval = new PendingApproval({ user: user._id, type: 'registration' });
    approval.status = 'approved';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = now;
    approval.rejectionReason = undefined;
    approval.notes = req.body.notes || '';
    await approval.save();

    try {
        await emailService.send(user.email, 'farmerApproved', {
            user,
            planName: user.selectedPlan || 'N/A',
            subscriptionExpiry: user.subscriptionExpiry,
        });
        if (user.phone) {
            await smsService.send(user.phone, 'farmerApproved', {
                user,
                planName: user.selectedPlan || 'N/A',
                subscriptionExpiry: user.subscriptionExpiry,
            });
        }
    } catch (err) {
        logger.error(`Approval notification failed: ${err.message}`);
    }

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            approvalStatus: user.approvalStatus,
            selectedPlan: user.selectedPlan,
            subscriptionExpiry: user.subscriptionExpiry,
            subscriptionStatus: user.subscriptionStatus,
        },
    }, 'User approved');
});

/* ============ REJECT USER ============ */
const rejectUser = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) return errorResponse(res, 'Rejection reason is required', 400);

    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);
    if (user.approvalStatus !== 'pending') {
        return errorResponse(res, `User is already ${user.approvalStatus}`, 400);
    }

    user.approvalStatus = 'rejected';
    user.isActive = false;
    user.rejectedBy = req.user.id;
    user.rejectedAt = new Date();
    user.rejectionReason = reason;
    user.subscriptionStatus = 'cancelled';
    await user.save();

    let approval = await PendingApproval.findOne({ user: user._id, type: 'registration' });
    if (!approval) approval = new PendingApproval({ user: user._id, type: 'registration' });
    approval.status = 'rejected';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = reason;
    approval.notes = req.body.notes || '';
    await approval.save();

    try {
        await emailService.send(user.email, 'farmerRejected', { user, reason });
        if (user.phone) {
            await smsService.send(user.phone, 'farmerRejected', { user, reason });
        }
    } catch (err) {
        logger.error(`Rejection notification failed: ${err.message}`);
    }

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            approvalStatus: user.approvalStatus,
        },
    }, 'User rejected');
});

/* ============ CONFIRM PAYMENT (manual) ============ */
const confirmPayment = asyncHandler(async (req, res) => {
    const { method, reference, note } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    const invoices = await Invoice.find({ user: user._id, status: { $in: ['sent', 'draft'] } });

    for (const inv of invoices) {
        inv.status = 'paid';
        inv.amountPaid = inv.total;
        inv.amountDue = 0;
        inv.paidAt = new Date();
        inv.paymentMethod = method || 'manual';
        inv.paymentRef = reference || null;
        await inv.save();
    }

    await Payment.updateMany(
        { user: user._id, status: 'pending' },
        {
            $set: {
                status: 'success',
                verifiedBy: req.user.id,
                verifiedAt: new Date(),
            },
        }
    );

    user.paymentStatus = 'paid';
    user.paymentMethod = method || 'manual';
    user.paymentReference = reference || null;
    user.paymentDate = new Date();
    await user.save();

    if (invoices.length > 0) {
        const primaryInvoice = invoices[0];

        try {
            await emailService.send(user.email, 'farmerPaymentReceived', {
                user,
                name: user.name,
                invoiceNumber: primaryInvoice.invoiceNumber,
                amount: primaryInvoice.total,
                currency: primaryInvoice.currency,
                paidAt: new Date(),
                paymentMethod: method || 'manual',
                paymentReference: reference || 'N/A',
            });
            if (user.phone) {
                await smsService.send(user.phone, 'farmerPaymentReceived', {
                    user,
                    invoiceNumber: primaryInvoice.invoiceNumber,
                    amount: primaryInvoice.total,
                });
            }
        } catch (err) {
            logger.error(`Payment confirmation notification failed: ${err.message}`);
        }

        try {
            const admins = await Admin.find({ isActive: true });
            for (const admin of admins) {
                await emailService.send(admin.email, 'adminPaymentReceived', {
                    user: { name: admin.name, email: admin.email },
                    farmer: { name: user.name, email: user.email, phone: user.phone },
                    invoiceNumber: primaryInvoice.invoiceNumber,
                    planName: primaryInvoice.plan,
                    amount: primaryInvoice.total,
                    paymentMethod: method || 'manual',
                    reference: reference || 'N/A',
                });
            }
        } catch (err) {
            logger.error(`Admin payment notification failed: ${err.message}`);
        }
    }

    return successResponse(res, {
        user: { id: user._id, name: user.name, paymentStatus: user.paymentStatus },
        invoicesPaid: invoices.length,
    }, 'Payment confirmed');
});

/* ============ APPROVAL HISTORY ============ */
const getApprovalHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, type } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const approvals = await PendingApproval.find(query)
        .populate('user', 'name email phone selectedPlan paymentStatus subscriptionExpiry')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const approvalsWithDetails = await Promise.all(
        approvals.map(async (approval) => {
            const invoice = await Invoice.findOne({ user: approval.user?._id })
                .sort({ createdAt: -1 })
                .lean();
            const payment = await Payment.findOne({ user: approval.user?._id })
                .sort({ createdAt: -1 })
                .lean();
            return { ...approval, invoice, payment };
        })
    );

    const total = await PendingApproval.countDocuments(query);

    return successResponse(res, {
        approvals: approvalsWithDetails,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

module.exports = {
    getPendingApprovals,
    approveUser,
    rejectUser,
    confirmPayment,
    getApprovalHistory,
};