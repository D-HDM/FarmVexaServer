const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Field name is required'],
        trim: true,
    },
    farm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farm',
        required: true,
    },
    crop: {
        type: String,
        trim: true,
    },
    size: {
        value: Number,
        unit: { type: String, enum: ['acres', 'hectares'], default: 'acres' },
    },
    soilType: String,
    status: {
        type: String,
        enum: ['active', 'fallow', 'harvested'],
        default: 'active',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Field', fieldSchema);