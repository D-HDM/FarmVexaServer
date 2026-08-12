const mongoose = require('mongoose');

const cropImageSchema = new mongoose.Schema({
    field: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Field',
        required: true,
    },
    cropType: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    storageType: {
        type: String,
        enum: ['local', 'cloudinary'],
        default: 'local',
    },
    cloudinaryId: String,
    diseaseDetected: String,
    confidence: Number,
    severity: {
        type: String,
        enum: ['low', 'moderate', 'high'],
    },
    symptoms: String,
    healthScore: Number,
    recommendation: String,
    aiUsed: String,
    modelVersion: String,
    status: {
        type: String,
        enum: ['uploaded', 'analyzing', 'completed', 'failed'],
        default: 'uploaded',
    },
    analysisTimestamp: Date,
}, {
    timestamps: true,
});

module.exports = mongoose.model('CropImage', cropImageSchema);