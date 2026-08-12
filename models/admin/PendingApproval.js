const mongoose = require('mongoose');

const pendingApprovalSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
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

module.exports = mongoose.model('PendingApproval', pendingApprovalSchema);