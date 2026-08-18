const mongoose = require('mongoose');

const paymentRecordSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    email: String,
    phone: String,
    amount: { type: Number, required: true },
    plan: String,
    type: {
        type: String,
        enum: ['registration', 'renewal', 'upgrade'],
        default: 'registration',
    },
    reference: String,
    status: {
        type: String,
        enum: ['pending', 'pending_verification', 'completed', 'failed', 'unpaid'],
        default: 'pending',
    },
    methodType: {
        type: String,
        enum: ['mpesa_stk', 'mpesa_send_money', 'mpesa_till', 'mpesa_paybill', 'bank', 'card', 'manual', 'other'],
        default: 'manual',
    },
    registrationData: { type: mongoose.Schema.Types.Mixed },
    mpesaReceiptNumber: String,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    verifiedAt: Date,
}, { timestamps: true });

paymentRecordSchema.index({ email: 1, createdAt: -1 });
paymentRecordSchema.index({ status: 1 });
paymentRecordSchema.index({ user: 1, type: 1 });
paymentRecordSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentRecord', paymentRecordSchema);