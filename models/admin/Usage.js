const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm'
    },

    endpoint: {
        type: String,
        enum: ['chat', 'crop_analysis', 'field_scan'],
        required: true
    },

    keyUsed: {
        type: String,
        enum: [
            // New canonical values
            'gemini_primary',
            'gemini_backup',
            'hdm',
            // Legacy values kept for older records
            'primary',
            'backup',
            'gemini',
            'hdm_fallback',
            'fieldscan_primary',
            'fieldscan_backup'
        ],
        default: 'gemini_primary'
    },

    tokensUsed: {
        type: Number,
        default: 0
    },

    success: {
        type: Boolean,
        default: true
    },

    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    requestTimestamp: {
        type: Date,
        default: Date.now
    }

}, {
    timestamps: true
});

// Indexes for usage queries and reporting
usageSchema.index({ user: 1, requestTimestamp: -1 });
usageSchema.index({ farm: 1, requestTimestamp: -1 });
usageSchema.index({ requestTimestamp: 1 });
usageSchema.index({ endpoint: 1, requestTimestamp: 1 });

// Normalize keyUsed casing before validation.
usageSchema.pre('save', function (next) {
    if (this.keyUsed && typeof this.keyUsed === 'string') {
        this.keyUsed = this.keyUsed.toLowerCase();
    }
    next();
});

module.exports = mongoose.model('Usage', usageSchema);