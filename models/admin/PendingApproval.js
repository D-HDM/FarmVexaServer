const mongoose = require('mongoose');

const pendingApprovalSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['registration', 'renewal', 'upgrade'],
        default: 'registration',
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    plan: {
        type: String,
        enum: ['Basic', 'Basic Monthly', 'Pro', 'Full Suite'],
    },
    oldPlan: {
        type: String,
    },
    newPlan: {
        type: String,
    },
    amount: {
        type: Number,
        default: 0,
    },
    paymentMethod: {
        type: String,
        enum: ['mpesa_stk', 'mpesa_send_money', 'mpesa_till', 'mpesa_paybill', 'bank', 'card', 'manual', null],
        default: null,
    },
    paymentReference: {
        type: String,
        default: null,
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    reviewedAt: Date,
    rejectionReason: String,
    notes: String,
}, {
    timestamps: true,
});

pendingApprovalSchema.index({ user: 1, status: 1 });
pendingApprovalSchema.index({ status: 1, createdAt: -1 });
pendingApprovalSchema.index({ type: 1, status: 1 });
pendingApprovalSchema.index({ user: 1, type: 1, status: 1 });

module.exports = mongoose.model('PendingApproval', pendingApprovalSchema);