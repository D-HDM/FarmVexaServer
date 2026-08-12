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
    },
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
        required: true,
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