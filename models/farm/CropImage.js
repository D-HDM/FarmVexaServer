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
        default: 'cloudinary',
    },
    cloudinaryId: String,
    diseaseDetected: String,
    confidence: Number,
    severity: {
        type: String,
        enum: ['none', 'low', 'moderate', 'high', 'uncertain', null],
        default: 'low',
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

// Normalize severity casing before validation.
cropImageSchema.pre('save', function (next) {
    if (this.severity && typeof this.severity === 'string') {
        const s = this.severity.toLowerCase();
        this.severity = ['none', 'low', 'moderate', 'high', 'uncertain'].includes(s)
            ? s
            : 'uncertain';
    }
    next();
});

module.exports = mongoose.model('CropImage', cropImageSchema);