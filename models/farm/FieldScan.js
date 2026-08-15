const mongoose = require('mongoose');

const fieldScanPhotoSchema = new mongoose.Schema({
    imageUrl: { type: String, required: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    timestamp: { type: Date },
    analysis: {
        disease: { type: String, default: 'Unknown' },
        confidence: { type: Number, default: 0 },
        severity: { type: String, enum: ['low', 'moderate', 'high', 'none'], default: 'low' },
        symptoms: { type: String, default: '' },
        recommendation: { type: String, default: '' },
        weeds: { type: Boolean, default: false },
        pests: { type: Boolean, default: false },
        healthScore: { type: Number, default: 0 },
    },
    keyUsed: { type: String, enum: ['fieldscan_primary', 'fieldscan_backup'], default: 'fieldscan_primary' },
});

const fieldScanSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true },
    field: { type: mongoose.Schema.Types.ObjectId, ref: 'Field', required: true },
    cropType: { type: String, required: true },
    
    // Stats
    totalFrames: { type: Number, default: 0 },
    preFilteredFrames: { type: Number, default: 0 },
    skippedFrames: { type: Number, default: 0 },
    analyzedFrames: { type: Number, default: 0 },
    geminiRequests: { type: Number, default: 0 },
    batchSize: { type: Number, default: 16 },
    duration: { type: Number, default: 0 }, // seconds
    
    // Skip reasons
    skipReasons: {
        blurry: { type: Number, default: 0 },
        duplicate: { type: Number, default: 0 },
        healthy: { type: Number, default: 0 },
        no_vegetation: { type: Number, default: 0 },
        invalid: { type: Number, default: 0 },
        download_failed: { type: Number, default: 0 },
    },
    
    // Photos + results
    photos: [fieldScanPhotoSchema],
    
    // Summary
    summary: {
        healthyCount: { type: Number, default: 0 },
        healthyPercentage: { type: Number, default: 0 },
        diseaseCount: { type: Number, default: 0 },
        diseases: [{
            name: { type: String },
            severity: { type: String },
            location: {
                lat: { type: Number, default: null },
                lng: { type: Number, default: null },
            },
        }],
        weeds: {
            pressure: { type: String, enum: ['None', 'Low', 'Moderate', 'High'], default: 'None' },
            hotspots: [{
                lat: { type: Number },
                lng: { type: Number },
                type: { type: String, default: 'Weeds' },
            }],
        },
        pests: {
            activity: { type: String, enum: ['None', 'Low', 'Moderate', 'High'], default: 'None' },
            affectedAreas: { type: Number, default: 0 },
        },
    },
    
    // Key usage
    keyUsage: {
        fieldscan_primary: { type: Number, default: 0 },
        fieldscan_backup: { type: Number, default: 0 },
    },
    
    // Status
    status: { type: String, enum: ['processing', 'completed', 'failed'], default: 'processing' },
    errorMessage: { type: String, default: '' },
    
    // Email
    emailSent: { type: Boolean, default: false },
    
}, { timestamps: true });

fieldScanSchema.index({ user: 1, createdAt: -1 });
fieldScanSchema.index({ field: 1, createdAt: -1 });
fieldScanSchema.index({ farm: 1, createdAt: -1 });

module.exports = mongoose.model('FieldScan', fieldScanSchema);