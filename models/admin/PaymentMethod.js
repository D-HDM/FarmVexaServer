const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
    code: {
        type: String,
        enum: ['mpesa_stk', 'mpesa_send', 'mpesa_send_money', 'mpesa_till', 'mpesa_paybill', 'bank', 'cash', 'stripe'],
        required: true,
        unique: true,
    },
    label: { type: String, required: true },
    mode: { type: String, enum: ['auto', 'manual'], default: 'manual' },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true, index: true },

    config: {
        // mpesa_stk
        shortcode: String,
        // mpesa_send / mpesa_send_money
        phone: String,
        // mpesa_till
        tillNumber: String,
        // mpesa_paybill
        paybillNumber: String,
        accountNumber: String,
        // bank
        bankName: String,
        accountName: String,
        branch: String,
        swift: String,
        // stripe
        publishableKey: String,
        // common
        name: String,
    },
}, { timestamps: true });

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);