const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', index: true },

    purpose: {
        type: String,
        enum: ['registration', 'renewal', 'upgrade'],
        required: true,
    },

    method: {
        type: String,
        enum: ['mpesa_stk', 'mpesa_send_money', 'mpesa_till', 'mpesa_paybill', 'bank', 'cash', 'manual', 'invoice'],
        default: 'mpesa_stk',
    },

    amount: { type: Number, required: true },
    currency: { type: String, default: 'KES' },

    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'cancelled'],
        default: 'pending',
        index: true,
    },

    providerRef: { type: String, index: true },
    checkoutRequestId: String,
    mpesaReceipt: String,
    phone: String,

    providerPayload: { type: mongoose.Schema.Types.Mixed },

    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    verifiedAt: Date,
}, { timestamps: true });

paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ invoice: 1, status: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);