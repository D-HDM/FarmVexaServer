const mongoose = require('mongoose');

const briefingLogSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    type: { type: String, enum: ['daily_briefing', 'reminder'], required: true },
    dateKey: { type: String, required: true }, // e.g., "2026-08-14-daily_briefing"
    sentAt: { type: Date, default: Date.now },
}, { timestamps: true });

briefingLogSchema.index({ farm: 1, type: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('BriefingLog', briefingLogSchema);