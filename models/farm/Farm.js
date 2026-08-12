const mongoose = require('mongoose');

const farmSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Farm name is required'],
        trim: true,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    location: {
        county: String,
        subCounty: String,
        ward: String,
        coordinates: {
            lat: Number,
            lng: Number,
        },
    },
    size: {
        value: Number,
        unit: { type: String, enum: ['acres', 'hectares'], default: 'acres' },
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Farm', farmSchema);