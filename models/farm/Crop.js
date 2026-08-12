const mongoose = require('mongoose');

const cropSchema = new mongoose.Schema({
    field: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Field',
        required: true,
    },
    cropType: {
        type: String,
        required: true,
        trim: true,
    },
    variety: {
        type: String,
        trim: true,
    },
    plantingDate: Date,
    expectedHarvestDate: Date,
    healthStatus: {
        type: String,
        enum: ['healthy', 'warning', 'critical'],
        default: 'healthy',
    },
    healthScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 100,
    },
    status: {
        type: String,
        enum: ['growing', 'harvested', 'failed'],
        default: 'growing',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Crop', cropSchema);