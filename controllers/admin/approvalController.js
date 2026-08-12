const User = require('../../models/farm/User');
const PendingApproval = require('../../models/admin/PendingApproval');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getPendingApprovals = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;

    const approvals = await PendingApproval.find({ status: 'pending' })
        .populate('user', 'name email phone county subCounty createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await PendingApproval.countDocuments({ status: 'pending' });

    return successResponse(res, {
        approvals,
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
    user.rejectionReason = undefined;
    await user.save();

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

    emailService.send(user.email, 'farmerApproved', { user }).catch(() => {});
    if (user.phone) {
        smsService.send(user.phone, 'farmerApproved', { user }).catch(() => {});
    }

    return successResponse(res, { user: { id: user._id, name: user.name, email: user.email, approvalStatus: user.approvalStatus } }, 'User approved');
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
    await user.save();

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

    return successResponse(res, { user: { id: user._id, name: user.name, email: user.email, approvalStatus: user.approvalStatus } }, 'User rejected');
});

const getApprovalHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (status) query.status = status;

    const approvals = await PendingApproval.find(query)
        .populate('user', 'name email phone')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await PendingApproval.countDocuments(query);

    return successResponse(res, {
        approvals,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
});

module.exports = {
    getPendingApprovals,
    approveUser,
    rejectUser,
    getApprovalHistory,
};