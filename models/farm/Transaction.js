const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    category: { type: String, enum: ['sales', 'inputs', 'labour', 'vet', 'transport', 'equipment', 'other'], required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    description: { type: String, trim: true },
    reference: { type: String, trim: true },
    relatedModule: { type: String, trim: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    paymentMethod: { type: String, enum: ['cash', 'mpesa', 'bank', 'credit'] },
    status: { type: String, enum: ['completed', 'pending'], default: 'completed' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

transactionSchema.index({ farm: 1, date: -1 });
transactionSchema.index({ type: 1, category: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);