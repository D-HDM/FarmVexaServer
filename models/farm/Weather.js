const mongoose = require('mongoose');

const forecastSchema = new mongoose.Schema({
    date: Date,
    tempMin: Number,
    tempMax: Number,
    condition: String,
    rainfall: Number,
    humidity: Number,
    windSpeed: Number,
});

const alertSchema = new mongoose.Schema({
    type: { type: String, enum: ['rain', 'drought', 'frost', 'storm', 'heatwave'] },
    severity: { type: String, enum: ['low', 'medium', 'high'] },
    message: String,
    recommendation: String,
    validFrom: Date,
    validTo: Date,
});

const weatherSchema = new mongoose.Schema({
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    date: { type: Date, required: true },
    temperature: {
        min: Number,
        max: Number,
        avg: Number,
    },
    humidity: Number,
    rainfall: Number,
    windSpeed: Number,
    condition: { type: String, enum: ['sunny', 'cloudy', 'rainy', 'stormy', 'partly_cloudy'] },
    forecast: [forecastSchema],
    alerts: [alertSchema],
    source: { type: String, enum: ['api', 'manual'], default: 'api' },
}, { timestamps: true });

weatherSchema.index({ farm: 1, date: -1 }, { unique: true });

module.exports = mongoose.model('Weather', weatherSchema);