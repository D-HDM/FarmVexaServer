const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
    },
    field: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Field',
    },
    type: {
        type: String,
        required: true,
    },
    severity: {
        type: String,
        enum: ['none', 'low', 'medium', 'high', 'critical', null],
        default: 'medium',
    },
    message: {
        type: String,
        required: true,
    },
    recommendation: String,
    isRead: {
        type: Boolean,
        default: false,
    },
    readAt: Date,
    sentSMS: {
        type: Boolean,
        default: false,
    },
    sentEmail: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Alert', alertSchema);