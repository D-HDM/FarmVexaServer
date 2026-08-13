const mongoose = require('mongoose');

const briefingLogSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    type: { type: String, enum: ['daily_briefing', 'reminder'], required: true },
    sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

briefingLogSchema.index({ farm: 1, type: 1, sentAt: -1 });

module.exports = mongoose.model('BriefingLog', briefingLogSchema);