const mongoose = require('mongoose');

const virtualDeviceSchema = new mongoose.Schema({
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
        required: true,
        unique: true,
    },
    name: {
        type: String,
        default: 'FarmVexa Virtual',
    },
    zone: {
        type: String,
        enum: ['field', 'storage', 'greenhouse', 'livestock'],
        default: 'field',
    },
    sensorType: {
        type: String,
        enum: ['dht', 'soil', 'co2', 'pir', 'acoustic', 'camera', 'weight'],
        default: 'dht',
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'maintenance'],
        default: 'online',
    },
    isVirtual: {
        type: Boolean,
        default: true,
    },
    lastReadingAt: Date,
}, { timestamps: true });

virtualDeviceSchema.index({ farm: 1 }, { unique: true });

module.exports = mongoose.model('VirtualDevice', virtualDeviceSchema);