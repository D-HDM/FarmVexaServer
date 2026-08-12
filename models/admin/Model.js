const mongoose = require('mongoose');

const trainingHistorySchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    accuracy: Number,
    loss: Number,
    epochs: Number,
    datasetSize: Number,
    duration: String,
});

const modelSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    version: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['ml_model', 'rule_based'],
        required: true,
    },
    cropType: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        enum: ['draft', 'training', 'trained', 'active', 'retired'],
        default: 'draft',
    },
    accuracy: Number,
    loss: Number,
    epochs: Number,
    datasetSize: Number,
    classes: [String],
    trainingTime: String,
    modelPath: String,
    configPath: String,
    trainingHistory: [trainingHistorySchema],
    deployedToPython: {
        type: Boolean,
        default: false,
    },
    lastTrained: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Model', modelSchema);