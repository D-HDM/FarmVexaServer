const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    field: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Field',
        required: false,  // Made optional for storage devices
    },
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
        required: true,
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
        default: 'offline',
    },
    batteryLevel: {
        type: Number,
        min: 0,
        max: 100,
    },
    lastSeen: Date,
    firmwareVersion: String,
}, {
    timestamps: true,
});

module.exports = mongoose.model('Device', deviceSchema);