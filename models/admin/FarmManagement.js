const mongoose = require('mongoose');

const farmManagementSchema = new mongoose.Schema({
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
        required: true,
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'suspended', 'rejected'],
        default: 'pending',
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    verificationDate: Date,
    notes: String,
    subscriptionTier: {
        type: String,
        enum: ['free', 'basic', 'premium'],
        default: 'free',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('FarmManagement', farmManagementSchema);