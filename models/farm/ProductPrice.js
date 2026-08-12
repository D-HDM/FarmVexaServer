const mongoose = require('mongoose');

const productPriceSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    product: { type: String, required: true, trim: true },
    category: { type: String, enum: ['animal', 'crop'], required: true },
    unit: { type: String, required: true, trim: true },
    pricePerUnit: { type: Number, required: true },
    quality: { type: String, enum: ['grade_a', 'grade_b', 'grade_c'] },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

productPriceSchema.index({ farm: 1, product: 1, quality: 1 });

module.exports = mongoose.model('ProductPrice', productPriceSchema);