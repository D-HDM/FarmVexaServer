const User = require('../../models/farm/User');
const TeamMember = require('../../models/farm/TeamMember');
const PendingApproval = require('../../models/admin/PendingApproval');
const Settings = require('../../models/admin/Settings');
const Admin = require('../../models/admin/Admin');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt');
const { generateRandomToken } = require('../../utils/generateToken');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');

const register = asyncHandler(async (req, res) => {
    const { name, email, phone, password, confirmPassword, county, subCounty, agreeToTerms } = req.body;
    const errors = [];
    if (!name || name.length < 2) errors.push('Name must be at least 2 characters');
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) errors.push('Valid email is required');
    if (!phone || !phone.match(/^(\+254|0)[17]\d{8}$/)) errors.push('Valid Kenyan phone number is required');
    if (!password || password.length < 6) errors.push('Password must be at least 6 characters');
    if (password !== confirmPassword) errors.push('Passwords do not match');
    if (!agreeToTerms) errors.push('You must agree to the terms');
    if (errors.length > 0) return errorResponse(res, errors.join('. '), 400);

    const settings = await Settings.findOne();
    if (!settings?.system?.allowSelfRegistration) return errorResponse(res, 'Self-registration is disabled. Contact admin.', 403);

    const existing = await User.findOne({ email });
    if (existing) return errorResponse(res, 'Email already registered', 400);

    const user = await User.create({ name, email, phone, password, county: county || undefined, subCounty: subCounty || undefined, role: 'farmer', isActive: false, approvalStatus: 'pending' });
    await PendingApproval.create({ user: user._id });

    emailService.send(user.email, 'farmerRegistrationPending', { user }).catch(() => {});
    const admins = await Admin.find({ isActive: true });
    for (const admin of admins) {
        emailService.send(admin.email, 'adminNewFarmer', { user: admin, farmer: user }).catch(() => {});
        if (admin.phone) smsService.send(admin.phone, 'adminNewFarmer', { user: admin, farmer: user }).catch(() => {});
    }

    return successResponse(res, { user: { id: user._id, name: user.name, email: user.email, phone: user.phone, county: user.county, subCounty: user.subCounty, approvalStatus: user.approvalStatus } }, 'Registration submitted. Awaiting admin approval.', 201);
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return errorResponse(res, 'Email and password are required', 400);

    let user = await User.findOne({ email }).select('+password');
    let role = 'farmer';

    if (!user) {
        user = await TeamMember.findOne({ email }).select('+password');
        if (user) role = user.role;
    }

    if (!user) return errorResponse(res, 'Invalid credentials', 401);

    if (role === 'farmer') {
        if (user.approvalStatus === 'pending') return errorResponse(res, 'Account pending approval.', 403);
        if (user.approvalStatus === 'rejected') return errorResponse(res, `Account rejected. Reason: ${user.rejectionReason || 'Contact support.'}`, 403);
        if (!user.isActive) return errorResponse(res, 'Account deactivated.', 403);
    } else {
        if (user.status !== 'active') return errorResponse(res, 'Account deactivated.', 403);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return errorResponse(res, 'Invalid credentials', 401);

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id, role);
    const refreshToken = generateRefreshToken(user._id, role);

    return successResponse(res, {
        user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role, farm: user.farm },
        token, refreshToken,
    }, 'Login successful');
});

const getProfile = asyncHandler(async (req, res) => {
    if (req.user.role !== 'farmer') {
        const user = await TeamMember.findById(req.user.id).select('-password');
        if (!user) return errorResponse(res, 'Not found', 404);
        return successResponse(res, { user: { ...user.toObject(), role: user.role } });
    }
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return errorResponse(res, 'User not found', 404);
    return successResponse(res, { user });
});

const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone, county, subCounty } = req.body;
    if (req.user.role !== 'farmer') {
        const user = await TeamMember.findByIdAndUpdate(req.user.id, { name, phone }, { new: true }).select('-password');
        return successResponse(res, { user }, 'Profile updated');
    }
    const user = await User.findByIdAndUpdate(req.user.id, { name, phone, county, subCounty }, { new: true, runValidators: true }).select('-password');
    return successResponse(res, { user }, 'Profile updated');
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const Model = req.user.role !== 'farmer' ? TeamMember : User;
    const user = await Model.findById(req.user.id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return errorResponse(res, 'Current password is incorrect', 400);
    user.password = newPassword;
    await user.save();
    return successResponse(res, null, 'Password changed');
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return errorResponse(res, 'No account with that email', 404);
    const resetToken = generateRandomToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = Date.now() + 30 * 60 * 1000;
    await user.save();
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await emailService.send(user.email, 'farmerPasswordReset', { user, resetUrl });
    return successResponse(res, null, 'Password reset link sent to email');
});

const resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return errorResponse(res, 'Token and new password are required', 400);
    const user = await User.findOne({ resetPasswordToken: token, resetPasswordExpire: { $gt: Date.now() } });
    if (!user) return errorResponse(res, 'Invalid or expired reset token', 400);
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    return successResponse(res, null, 'Password reset successful');
});

const refreshTokenHandler = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return errorResponse(res, 'Invalid token', 401);
    const newToken = generateToken(user._id, 'farmer');
    const newRefreshToken = generateRefreshToken(user._id, 'farmer');
    return successResponse(res, { token: newToken, refreshToken: newRefreshToken });
});

module.exports = { register, login, getProfile, updateProfile, changePassword, forgotPassword, resetPassword, refreshTokenHandler };