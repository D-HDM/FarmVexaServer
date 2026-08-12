const mongoose = require('mongoose');

const animalSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    tagId: { type: String, required: true, trim: true },
    type: { type: String, enum: ['cattle', 'goat', 'sheep', 'pig', 'poultry', 'other'], required: true },
    breed: { type: String, trim: true, set: (v) => v === '' ? undefined : v },
    category: { type: String, trim: true, set: (v) => v === '' ? undefined : v },
    name: { type: String, trim: true, set: (v) => v === '' ? undefined : v },
    gender: { type: String, enum: ['male', 'female'], set: (v) => v === '' ? undefined : v },
    birthDate: Date,
    acquisitionDate: Date,
    source: { type: String, trim: true, set: (v) => v === '' ? undefined : v },
    weight: { type: Number },
    color: { type: String, trim: true, set: (v) => v === '' ? undefined : v },
    status: { type: String, enum: ['active', 'sold', 'dead', 'lost'], default: 'active' },
    isBatch: { type: Boolean, default: false },
    batchName: { type: String, trim: true, set: (v) => v === '' ? undefined : v },
    batchQuantity: { type: Number },
    batchMortality: { type: Number, default: 0 },
    batchCurrent: { type: Number },
    motherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal' },
    notes: { type: String, trim: true, set: (v) => v === '' ? undefined : v },
}, { timestamps: true });

animalSchema.index({ farm: 1, type: 1 });
animalSchema.index({ tagId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Animal', animalSchema);