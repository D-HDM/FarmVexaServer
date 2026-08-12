const mongoose = require('mongoose');

const usageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm' },
    endpoint: { type: String, enum: ['chat', 'crop_analysis'], required: true },
    tokensUsed: { type: Number, default: 0 },
    success: { type: Boolean, default: true },
    requestTimestamp: { type: Date, default: Date.now },
}, { timestamps: true });

usageSchema.index({ user: 1, requestTimestamp: -1 });
usageSchema.index({ farm: 1, requestTimestamp: -1 });
usageSchema.index({ requestTimestamp: 1 });

module.exports = mongoose.model('Usage', usageSchema);