const mongoose = require('mongoose');

const marketProductSchema = new mongoose.Schema({
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
        type: String,
        enum: ['vegetables', 'fruits', 'livestock', 'poultry', 'dairy', 'grains', 'other'],
        required: true,
    },
    price: { type: Number, required: true },
    unit: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true },
    photos: [{ type: String }],
    contactPhone: { type: String, trim: true },
    contactWhatsapp: { type: String, trim: true },
    contactEmail: { type: String, trim: true },
    location: {
        county: String,
        subCounty: String,
        exactDirection: String,
    },
    status: { type: String, enum: ['active', 'sold', 'inactive'], default: 'active' },
}, { timestamps: true });

marketProductSchema.index({ farmer: 1, status: 1 });
marketProductSchema.index({ category: 1, status: 1 });
marketProductSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('MarketProduct', marketProductSchema);