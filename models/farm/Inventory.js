const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['feed', 'medicine', 'fertilizer', 'pesticide', 'seeds', 'tools', 'other'], required: true },
    quantity: { type: Number, required: true, default: 0 },
    unit: { type: String, trim: true },
    purchaseDate: Date,
    expiryDate: Date,
    cost: { type: Number },
    supplier: { type: String, trim: true },
    lowStockAlert: { type: Number },
    notes: { type: String, trim: true },
}, { timestamps: true });

inventorySchema.index({ farm: 1, category: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);