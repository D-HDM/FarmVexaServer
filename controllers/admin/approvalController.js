const User = require('../../models/farm/User');
const PendingApproval = require('../../models/admin/PendingApproval');
const PaymentRecord = require('../../models/admin/PaymentRecord');
const Invoice = require('../../models/admin/Invoice');
const Payment = require('../../models/admin/Payment');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

/* ============ LIST PENDING APPROVALS ============ */
const getPendingApprovals = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const approvals = await PendingApproval.find({ status: 'pending' })
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
            const payment = await PaymentRecord.findOne({ user: approval.user?._id })
                .sort({ createdAt: -1 })
                .lean();
            return { ...approval, invoice, payment };
        })
    );

    const total = await PendingApproval.countDocuments({ status: 'pending' });

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

    user.approvalStatus = 'approved';
    user.isActive = true;
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    user.paymentStatus = 'paid';
    user.rejectionReason = undefined;

    if (user.planInterval === 'monthly') {
        user.subscriptionStartDate = new Date();
        user.subscriptionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        user.subscriptionStatus = 'active';
    } else {
        user.subscriptionStartDate = new Date();
        user.subscriptionExpiry = null;
        user.subscriptionStatus = 'active';
    }

    await user.save();

    // Mark all invoices paid
    try {
        const invoices = await Invoice.find({ user: user._id, status: { $in: ['sent', 'draft'] } });
        for (const inv of invoices) {
            inv.status = 'paid';
            inv.amountPaid = inv.total;
            inv.amountDue = 0;
            inv.paidAt = new Date();
            inv.paymentMethod = inv.paymentMethod || 'manual';
            await inv.save();
        }
    } catch (err) {
        logger.error(`Invoice update on approval failed: ${err.message}`);
    }

    // Update Payment records
    try {
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
    } catch (err) {
        logger.error(`Payment update on approval failed: ${err.message}`);
    }

    // PendingApproval update
    let approval = await PendingApproval.findOne({ user: user._id });
    if (!approval) approval = new PendingApproval({ user: user._id });
    approval.status = 'approved';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = undefined;
    approval.notes = req.body.notes || '';
    await approval.save();

    // Notify farmer
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

    // Cancel invoices
    try {
        await Invoice.updateMany(
            { user: user._id, status: { $in: ['sent', 'draft'] } },
            { $set: { status: 'cancelled' } }
        );
    } catch (err) {
        logger.error(`Invoice cancel on rejection failed: ${err.message}`);
    }

    // Fail pending payments
    try {
        await Payment.updateMany(
            { user: user._id, status: 'pending' },
            {
                $set: {
                    status: 'failed',
                    verifiedBy: req.user.id,
                    verifiedAt: new Date(),
                },
            }
        );
    } catch (err) {
        logger.error(`Payment fail on rejection failed: ${err.message}`);
    }

    // PendingApproval update
    let approval = await PendingApproval.findOne({ user: user._id });
    if (!approval) approval = new PendingApproval({ user: user._id });
    approval.status = 'rejected';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = reason;
    approval.notes = req.body.notes || '';
    await approval.save();

    // Notify farmer
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

/* ============ CONFIRM PAYMENT (without approving) ============ */
const confirmPayment = asyncHandler(async (req, res) => {
    const { method, reference, note } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);

    // Mark all sent/draft invoices as paid
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

    // Mark pending payments successful
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
    await user.save();

    // Notify farmer
    if (invoices.length > 0) {
        try {
            await emailService.send(user.email, 'farmerPaymentReceived', {
                user,
                invoiceNumber: invoices[0].invoiceNumber,
                amount: invoices[0].total,
                paymentMethod: method || 'manual',
                paymentReference: reference || 'N/A',
                paidAt: new Date(),
            });
            if (user.phone) {
                await smsService.send(user.phone, 'farmerPaymentReceived', {
                    user,
                    invoiceNumber: invoices[0].invoiceNumber,
                    amount: invoices[0].total,
                });
            }
        } catch (err) {
            logger.error(`Payment confirmation notification failed: ${err.message}`);
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
            const payment = await PaymentRecord.findOne({ user: approval.user?._id })
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