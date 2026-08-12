const mongoose = require('mongoose');

const paymentModelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'KES',
    },
    interval: {
        type: String,
        enum: ['one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
        required: true,
    },
    features: [{
        type: String,
        trim: true,
    }],
    maxFarms: {
        type: Number,
        default: 1,
    },
    maxDevices: {
        type: Number,
        default: 1,
    },
    aiRequestsPerDay: {
        type: Number,
        default: 50,
    },
    enabled: {
        type: Boolean,
        default: true,
    },
    isDefault: {
        type: Boolean,
        default: false,
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('PaymentModel', paymentModelSchema);