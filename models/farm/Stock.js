const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
    type: { type: String, enum: ['in', 'out'], required: true },
    quantity: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
    reference: { type: String, trim: true },
    relatedModule: { type: String, trim: true },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
});

const stockSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    product: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 0 },
    minimumStock: { type: Number, default: 0 },
    pricePerUnit: { type: Number, default: 0 },
    movements: [stockMovementSchema],
}, { timestamps: true });

stockSchema.index({ farm: 1, product: 1, unit: 1 }, { unique: true });

module.exports = mongoose.model('Stock', stockSchema);