const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    type: {
        type: String,
        enum: ['mpesa_stk', 'mpesa_send_money', 'mpesa_till', 'mpesa_paybill', 'bank', 'card', 'other'],
        required: true,
    },
    details: {
        tillNumber: String,
        paybill: String,
        accountNumber: String,
        phoneNumber: String,
        bankName: String,
        accountName: String,
        branch: String,
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

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);