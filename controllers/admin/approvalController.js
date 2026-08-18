const User = require('../../models/farm/User');
const PendingApproval = require('../../models/admin/PendingApproval');
const PaymentRecord = require('../../models/admin/PaymentRecord');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

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
            const payment = await PaymentRecord.findOne({ user: approval.user?._id }).sort({ createdAt: -1 }).lean();
            return { ...approval, payment };
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

const approveUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }

    if (user.approvalStatus !== 'pending') {
        return errorResponse(res, `User is already ${user.approvalStatus}`, 400);
    }

    user.approvalStatus = 'approved';
    user.isActive = true;
    user.approvedBy = req.user.id;
    user.approvedAt = new Date();
    user.paymentStatus = 'paid';
    user.rejectionReason = undefined;

    // === SUBSCRIPTION ACTIVATION ===
    if (user.planInterval === 'monthly') {
        // Monthly plan — activate 30 days
        user.subscriptionStartDate = new Date();
        user.subscriptionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        user.subscriptionStatus = 'active';
    } else {
        // One-time plan — lifetime
        user.subscriptionStartDate = new Date();
        user.subscriptionExpiry = null;
        user.subscriptionStatus = 'active';
    }

    await user.save();

    // Update payment record
    const payment = await PaymentRecord.findOne({ user: user._id }).sort({ createdAt: -1 });
    if (payment) {
        payment.status = 'completed';
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = new Date();
        await payment.save();
    }

    let approval = await PendingApproval.findOne({ user: user._id });
    if (!approval) {
        approval = new PendingApproval({ user: user._id });
    }
    approval.status = 'approved';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = undefined;
    approval.notes = req.body.notes || '';
    await approval.save();

    // Send emails with plan + expiry info
    emailService.send(user.email, 'farmerApproved', {
        user,
        planName: user.selectedPlan || 'N/A',
        subscriptionExpiry: user.subscriptionExpiry,
    }).catch(() => {});
    
    if (user.phone) {
        smsService.send(user.phone, 'farmerApproved', {
            user,
            planName: user.selectedPlan || 'N/A',
            subscriptionExpiry: user.subscriptionExpiry,
        }).catch(() => {});
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

const rejectUser = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    if (!reason) {
        return errorResponse(res, 'Rejection reason is required', 400);
    }

    const user = await User.findById(req.params.id);
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }

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

    const payment = await PaymentRecord.findOne({ user: user._id }).sort({ createdAt: -1 });
    if (payment) {
        payment.status = 'failed';
        payment.verifiedBy = req.user.id;
        payment.verifiedAt = new Date();
        await payment.save();
    }

    let approval = await PendingApproval.findOne({ user: user._id });
    if (!approval) {
        approval = new PendingApproval({ user: user._id });
    }
    approval.status = 'rejected';
    approval.reviewedBy = req.user.id;
    approval.reviewedAt = new Date();
    approval.rejectionReason = reason;
    approval.notes = req.body.notes || '';
    await approval.save();

    emailService.send(user.email, 'farmerRejected', { user, reason }).catch(() => {});
    if (user.phone) {
        smsService.send(user.phone, 'farmerRejected', { user, reason }).catch(() => {});
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

    const approvalsWithPayment = await Promise.all(
        approvals.map(async (approval) => {
            const payment = await PaymentRecord.findOne({ user: approval.user?._id }).sort({ createdAt: -1 }).lean();
            return { ...approval, payment };
        })
    );

    const total = await PendingApproval.countDocuments(query);

    return successResponse(res, {
        approvals: approvalsWithPayment,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
});

module.exports = {
    getPendingApprovals,
    approveUser,
    rejectUser,
    getApprovalHistory,
};