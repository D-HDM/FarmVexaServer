const mongoose = require('mongoose');

const healthRecordSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    animal: { type: mongoose.Schema.Types.ObjectId, ref: 'Animal', required: true },
    recordType: { type: String, enum: ['vaccination', 'treatment', 'checkup', 'disease', 'deworming'], required: true },
    date: { type: Date, required: true },
    description: { type: String, trim: true },
    diagnosis: { type: String, trim: true },
    treatment: { type: String, trim: true },
    medication: { type: String, trim: true },
    dosage: { type: String, trim: true },
    cost: { type: Number },
    vetName: { type: String, trim: true },
    vetContact: { type: String, trim: true },
    nextCheckup: Date,
    attachments: [String],
    notes: { type: String, trim: true },
}, { timestamps: true });

healthRecordSchema.index({ animal: 1, date: -1 });
healthRecordSchema.index({ nextCheckup: 1 });

module.exports = mongoose.model('HealthRecord', healthRecordSchema);