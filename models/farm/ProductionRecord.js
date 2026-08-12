const mongoose = require('mongoose');

const productionRecordSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    animal: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal' },
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field' },
    type: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, trim: true },
    quality: { type: String, enum: ['grade_a', 'grade_b', 'grade_c'] },
    pricePerUnit: { type: Number },
    totalValue: { type: Number },
    session: { type: String, trim: true },
    buyer: { type: String, trim: true },
    notes: { type: String, trim: true },
}, { timestamps: true });

productionRecordSchema.index({ farm: 1, date: -1 });
productionRecordSchema.index({ animal: 1, date: -1 });

module.exports = mongoose.model('ProductionRecord', productionRecordSchema);