const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { 
        type: String, 
        enum: ['user_guide', 'copyright', 'pricing', 'terms', 'privacy', 'cookies', 'other'], 
        required: true 
    },
    visibility: { 
        type: String, 
        enum: ['public', 'farmer', 'admin'], 
        default: 'public' 
    },
    cloudinaryUrl: { type: String, required: true },
    cloudinaryPublicId: { type: String, required: true },
    fileType: { type: String },
    fileSize: { type: Number },
    version: { type: String, default: '1.0.0' },
    platform: { type: String, enum: ['web', 'desktop', 'mobile', 'all'], default: 'all' },
    enabled: { type: Boolean, default: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

documentSchema.index({ type: 1, visibility: 1, enabled: 1 });
documentSchema.index({ createdAt: -1 });

// Default visibility based on type
documentSchema.pre('save', function(next) {
    if (!this.visibility) {
        const defaultVisibility = {
            user_guide: 'farmer',
            copyright: 'admin',
            pricing: 'public',
            terms: 'public',
            privacy: 'public',
            cookies: 'public',
            other: 'public',
        };
        this.visibility = defaultVisibility[this.type] || 'public';
    }
    next();
});

module.exports = mongoose.model('Document', documentSchema);