const mongoose = require('mongoose');

const equipmentSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ['tractor', 'plough', 'sprayer', 'milking', 'incubator', 'feeder', 'waterer', 'tool', 'vehicle', 'other'], required: true },
    purchaseDate: Date,
    cost: { type: Number },
    condition: { type: String, enum: ['new', 'good', 'fair', 'poor', 'broken'], default: 'good' },
    lastMaintenance: Date,
    nextMaintenance: Date,
    maintenanceFrequency: { type: String, enum: ['weekly', 'monthly', 'quarterly', 'biannually', 'annually'] },
    notes: { type: String, trim: true },
}, { timestamps: true });

equipmentSchema.index({ farm: 1, nextMaintenance: 1 });

module.exports = mongoose.model('Equipment', equipmentSchema);