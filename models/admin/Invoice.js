const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    qty: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
}, { _id: false });

const paymentInstructionSchema = new mongoose.Schema({
    code: { type: String },
    method: { type: String },
    mode: { type: String, enum: ['auto', 'manual'], default: 'manual' },
    title: { type: String },
    description: { type: String, default: '' },
    steps: [{ type: String }],
    recipient: { type: mongoose.Schema.Types.Mixed, default: {} },
    action: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
    plan: { type: String, required: true },
    planInterval: { type: String, enum: ['one_time', 'monthly'], default: 'one_time' },

    type: {
        type: String,
        enum: ['registration', 'renewal', 'upgrade'],
        default: 'registration',
    },

    items: [invoiceItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    currency: { type: String, default: 'KES' },

    customerSnapshot: {
        name: String,
        email: String,
        phone: String,
    },

    status: {
        type: String,
        enum: ['draft', 'sent', 'paid', 'failed', 'cancelled', 'expired'],
        default: 'sent',
    },

    issuedAt: { type: Date, default: Date.now },
    sentAt: { type: Date, default: Date.now },
    dueDate: { type: Date, required: true },
    paidAt: Date,
    reminderSentAt: Date,

    paymentMethod: String,
    paymentRef: String,

    paymentInstructions: [paymentInstructionSchema],

    notes: String,

    stkLastRequest: {
        checkoutRequestId: String,
        phone: String,
        requestedAt: Date,
    },
}, { timestamps: true });

invoiceSchema.index({ user: 1, status: 1 });
invoiceSchema.index({ status: 1, createdAt: -1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ dueDate: 1, status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);