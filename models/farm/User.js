const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters'],
        maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false,
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        trim: true,
        match: [/^(\+254|0)[17]\d{8}$/, 'Please enter a valid Kenyan phone number'],
    },
    county: {
        type: String,
        trim: true,
    },
    subCounty: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        enum: ['farmer'],
        default: 'farmer',
    },
    isActive: {
        type: Boolean,
        default: false,
    },
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    approvedAt: Date,
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
    rejectedAt: Date,
    rejectionReason: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
}, {
    timestamps: true,
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);