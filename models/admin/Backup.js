const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    size: { type: Number },
    collections: { type: Number },
    documents: { type: Number },
    status: { type: String, enum: ['created', 'uploaded', 'deleted'], default: 'created' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Backup', backupSchema);