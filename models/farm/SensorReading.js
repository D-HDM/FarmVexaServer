const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
    device: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Device',
        required: true,
    },
    field: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Field',
        required: false,  // Made optional for storage sensors
    },
    temperature: Number,
    humidity: Number,
    soilMoisture: Number,
    lightLevel: Number,
    soilPH: Number,
    co2: Number,        // ppm — for storage insect detection
    motion: Boolean,    // PIR motion detected — for rat detection
    npk: {
        nitrogen: Number,
        phosphorus: Number,
        potassium: Number,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

sensorReadingSchema.index({ device: 1, timestamp: -1 });
sensorReadingSchema.index({ field: 1, timestamp: -1 });

module.exports = mongoose.model('SensorReading', sensorReadingSchema);