const User = require('../../models/farm/User');
const Farm = require('../../models/farm/Farm');
const TeamMember = require('../../models/farm/TeamMember');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );
};

const register = asyncHandler(async (req, res) => {
    const { name, email, phone, password, county, subCounty } = req.body;

    if (!name || !email || !phone || !password) {
        return errorResponse(res, 'All fields are required', 400);
    }

    const existing = await User.findOne({ email });
    if (existing) return errorResponse(res, 'Email already registered', 400);

    const user = await User.create({
        name,
        email,
        phone,
        password,
        county,
        subCounty,
        role: 'farmer',
        approvalStatus: 'pending',
        isActive: false,
    });

    // Send pending email
    emailService.send(email, 'farmerRegistrationPending', {
        user,
        data: { name, email, phone, county, subCounty },
    }).catch(() => {});

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            approvalStatus: user.approvalStatus,
        },
    }, 'Registration submitted. Awaiting approval.', 201);
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return errorResponse(res, 'Email and password required', 400);
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) return errorResponse(res, 'Invalid credentials', 401);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return errorResponse(res, 'Invalid credentials', 401);

    if (user.approvalStatus !== 'approved') {
        return errorResponse(res, 'Account not approved yet', 403);
    }

    const isExpired = user.subscriptionExpiry && new Date() > new Date(user.subscriptionExpiry);

    if (isExpired) {
        user.subscriptionStatus = 'expired';
        user.isActive = false;
        await user.save();
    }

    if (!isExpired && !user.isActive) {
        return errorResponse(res, 'Account deactivated', 403);
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    if (isExpired) {
        return res.status(402).json({
            success: false,
            message: 'Subscription expired. Please renew.',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    selectedPlan: user.selectedPlan,
                    subscriptionStatus: user.subscriptionStatus,
                    subscriptionExpiry: user.subscriptionExpiry,
                },
                token,
                refreshToken,
                subscriptionExpired: true,
            },
            timestamp: new Date().toISOString(),
        });
    }

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            county: user.county,
            subCounty: user.subCounty,
            selectedPlan: user.selectedPlan,
            subscriptionExpiry: user.subscriptionExpiry,
            subscriptionStatus: user.subscriptionStatus,
        },
        token,
        refreshToken,
    }, 'Login successful');
});
const getProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return errorResponse(res, 'User not found', 404);
    return successResponse(res, { user });
});

const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone, county, subCounty } = req.body;
    const updateFields = {};
    if (name) updateFields.name = name;
    if (phone) updateFields.phone = phone;
    if (county) updateFields.county = county;
    if (subCounty) updateFields.subCounty = subCounty;

    const user = await User.findByIdAndUpdate(req.user.id, updateFields, {
        new: true,
        runValidators: true,
    }).select('-password');

    if (!user) return errorResponse(res, 'User not found', 404);
    return successResponse(res, { user }, 'Profile updated');
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return errorResponse(res, 'Current and new password required', 400);
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) return errorResponse(res, 'User not found', 404);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return errorResponse(res, 'Current password is incorrect', 400);

    user.password = newPassword;
    await user.save();

    return successResponse(res, null, 'Password changed');
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email required', 400);

    const user = await User.findOne({ email });
    if (!user) return errorResponse(res, 'If that email exists, a reset link has been sent', 200);

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    emailService.send(email, 'farmerPasswordReset', {
        user,
        data: { resetUrl },
    }).catch(() => {});

    return successResponse(res, null, 'If that email exists, a reset link has been sent');
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) return errorResponse(res, 'Password required', 400);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: new Date() },
    });

    if (!user) return errorResponse(res, 'Invalid or expired token', 400);

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    return successResponse(res, null, 'Password reset successful');
});

const refreshTokenHandler = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return errorResponse(res, 'Refresh token required', 400);

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) return errorResponse(res, 'User not found', 404);
        if (!user.isActive) return errorResponse(res, 'Account deactivated', 403);

        const newToken = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);

        return successResponse(res, { token: newToken, refreshToken: newRefreshToken }, 'Token refreshed');
    } catch (error) {
        return errorResponse(res, 'Invalid refresh token', 401);
    }
});

const getSubscriptionDetails = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return errorResponse(res, 'User not found', 404);

    return successResponse(res, {
        plan: user.selectedPlan,
        planInterval: user.planInterval,
        planPrice: user.planPrice,
        subscriptionExpiry: user.subscriptionExpiry,
        subscriptionStatus: user.subscriptionStatus,
        lastRenewalDate: user.lastRenewalDate,
        renewalCount: user.renewalCount,
        isExpired: user.subscriptionExpiry ? new Date() > new Date(user.subscriptionExpiry) : false,
    });
});

module.exports = {
    register,
    login,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    refreshTokenHandler,
    getSubscriptionDetails,
};