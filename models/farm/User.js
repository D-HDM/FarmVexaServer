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
    
    // === SUBSCRIPTION + PLAN FIELDS ===
    selectedPlan: {
        type: String,
        enum: ['Basic', 'Basic Monthly', 'Pro', 'Full Suite'],
        default: 'Basic',
    },
    planInterval: {
        type: String,
        enum: ['one_time', 'monthly'],
        default: 'one_time',
    },
    planPrice: {
        type: Number,
        default: 0,
    },
    paymentStatus: {
        type: String,
        enum: ['pending_verification', 'paid', 'unpaid', 'failed'],
        default: 'unpaid',
    },
    paymentMethod: {
        type: String,
        enum: ['mpesa_stk', 'mpesa_send_money', 'mpesa_till', 'mpesa_paybill', 'bank', 'card', 'manual', null],
        default: null,
    },
    paymentReference: {
        type: String,
        default: null,
    },
    paymentDate: Date,
    
    // === SUBSCRIPTION LIFECYCLE ===
    subscriptionExpiry: {
        type: Date,
        default: null, // null = lifetime (one-time plans)
    },
    subscriptionStatus: {
        type: String,
        enum: ['active', 'expired', 'pending_renewal', 'cancelled'],
        default: 'active',
    },
    lastRenewalDate: Date,
    renewalCount: {
        type: Number,
        default: 0,
    },
    subscriptionStartDate: {
        type: Date,
        default: null,
    },
    lastRenewalReminder: Date, 
    
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    lastLogin: Date,
}, {
    timestamps: true,
});


userSchema.methods.activateSubscription = function (durationDays = 30) {
    this.subscriptionStartDate = new Date();
    this.subscriptionExpiry = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    this.subscriptionStatus = 'active';
    return this.save();
};


userSchema.methods.renewSubscription = function (durationDays = 30) {
    const baseDate = this.subscriptionExpiry && new Date() < new Date(this.subscriptionExpiry)
        ? new Date(this.subscriptionExpiry)
        : new Date();
    this.subscriptionExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    this.subscriptionStatus = 'active';
    this.lastRenewalDate = new Date();
    this.renewalCount += 1;
    return this.save();
};


userSchema.methods.isSubscriptionExpired = function () {
    if (!this.subscriptionExpiry) return false; // Lifetime
    return new Date() > new Date(this.subscriptionExpiry);
};

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