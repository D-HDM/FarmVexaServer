const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../../models/farm/User');
const Invoice = require('../../models/admin/Invoice');
const Settings = require('../../models/admin/Settings');
const Admin = require('../../models/admin/Admin');
const PendingApproval = require('../../models/admin/PendingApproval');
const invoiceService = require('../../services/invoiceService');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const planService = require('../../services/planService');
const paymentInstructionsService = require('../../services/paymentInstructionsService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const generateToken = (user) => jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

const generateRefreshToken = (user) => jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
);

async function withFreshInstructions(invoice) {
    if (!invoice) return null;
    try {
        const fresh = await paymentInstructionsService.getPaymentInstructions({
            amount: invoice.amountDue ?? invoice.total,
            currency: invoice.currency || 'KES',
            invoiceNumber: invoice.invoiceNumber,
        });
        return { ...invoice, paymentInstructions: fresh };
    } catch (err) {
        logger.error(`Fresh instructions failed for ${invoice.invoiceNumber}: ${err.message}`);
        return invoice;
    }
}

function shapeInvoice(invoice) {
    if (!invoice) return null;
    return {
        invoiceNumber: invoice.invoiceNumber,
        amountDue: invoice.amountDue,
        amountPaid: invoice.amountPaid,
        total: invoice.total,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        status: invoice.status,
        paymentMethod: invoice.paymentMethod,
        paymentRef: invoice.paymentRef,
        paymentInstructions: invoice.paymentInstructions,
        invoiceUrl: `${process.env.CLIENT_URL}/invoice/${invoice.invoiceNumber}`,
    };
}

/* ============ REGISTER ============ */
const register = asyncHandler(async (req, res) => {
    const { name, email, phone, password, county, subCounty, plan } = req.body;

    if (!name || !email || !phone || !password) {
        return errorResponse(res, 'All fields are required', 400);
    }
    if (!plan) return errorResponse(res, 'Plan is required', 400);

    const settings = await Settings.findOne();
    if (settings?.system?.allowSelfRegistration === false) {
        return errorResponse(res, 'Registration is currently closed', 403);
    }

    const existing = await User.findOne({ email });
    if (existing) return errorResponse(res, 'Email already registered', 400);

    const planInfo = await planService.getByName(plan);
    if (!planInfo) return errorResponse(res, 'Invalid or disabled plan', 400);

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
        selectedPlan: plan,
        planInterval: planInfo.interval,
        planPrice: planInfo.price,
        paymentStatus: 'unpaid',
        subscriptionStatus: 'expired',
        subscriptionExpiry: null,
        subscriptionStartDate: null,
    });

    await PendingApproval.create({
        user: user._id,
        type: 'registration',
        status: 'pending',
        plan,
        amount: planInfo.price,
    });

    let invoice = null;
    try {
        const result = await invoiceService.generateInvoice({
            userId: user._id,
            user,
            plan,
            planPrice: planInfo.price,
            planInterval: planInfo.interval,
            type: 'registration',
        });
        invoice = result.invoice;
    } catch (err) {
        logger.error(`Invoice generation failed: ${err.message}`);
    }

    const invoiceUrl = invoice ? `${process.env.CLIENT_URL}/invoice/${invoice.invoiceNumber}` : null;

    try {
        await emailService.send(email, 'farmerRegistrationPending', {
            user: { name, email, phone },
            name, email, phone, county, subCounty,
            planName: plan,
            amount: planInfo.price,
            interval: planInfo.interval,
            invoiceNumber: invoice?.invoiceNumber,
            dueDate: invoice?.dueDate,
            paymentInstructions: invoice?.paymentInstructions || [],
            invoiceUrl,
        });
        logger.info(`Registration email sent to ${email}`);
    } catch (err) {
        logger.error(`Registration email failed: ${err.message}`);
    }

    if (invoice) {
        try {
            await emailService.send(email, 'farmerInvoice', {
                user: { name, email, phone },
                invoiceNumber: invoice.invoiceNumber,
                amount: invoice.amountDue,
                currency: invoice.currency,
                planName: plan,
                dueDate: invoice.dueDate,
                paymentInstructions: invoice.paymentInstructions || [],
                invoiceUrl,
            });
            logger.info(`Invoice email sent to ${email}`);
        } catch (err) {
            logger.error(`Invoice email failed: ${err.message}`);
        }
    }

    try {
        const admins = await Admin.find({ isActive: true });
        for (const admin of admins) {
            await emailService.send(admin.email, 'adminNewFarmer', {
                user: { name: admin.name, email: admin.email },
                farmer: { name, email, phone },
                planName: plan,
                amount: planInfo.price,
                invoiceNumber: invoice?.invoiceNumber,
            });
        }
        logger.info(`Admin notification sent for ${email}`);
    } catch (err) {
        logger.error(`Admin notification failed: ${err.message}`);
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            approvalStatus: user.approvalStatus,
            selectedPlan: user.selectedPlan,
            paymentStatus: user.paymentStatus,
        },
        plan: { name: plan, price: planInfo.price, interval: planInfo.interval },
        invoice: shapeInvoice(invoice),
        scope: 'pending',
        token,
        refreshToken,
    }, 'Registration submitted. Awaiting payment.', 201);
});

/* ============ LOGIN ============ */
const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return errorResponse(res, 'Email and password required', 400);

    const user = await User.findOne({ email }).select('+password');
    if (!user) return errorResponse(res, 'Invalid credentials', 401);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return errorResponse(res, 'Invalid credentials', 401);

    if (user.approvalStatus === 'rejected') {
        return errorResponse(res, 'Account was rejected. Contact support.', 403);
    }

    let scope = 'active';
    if (user.approvalStatus === 'pending') scope = 'pending';
    if (user.subscriptionExpiry && new Date() > new Date(user.subscriptionExpiry)) scope = 'expired';

    let invoice = null;
    if (scope === 'pending' || scope === 'expired' || user.paymentStatus !== 'paid') {
        const raw = await Invoice.findOne({ user: user._id })
            .sort({ createdAt: -1 })
            .lean();
        invoice = await withFreshInstructions(raw);
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            county: user.county,
            subCounty: user.subCounty,
            approvalStatus: user.approvalStatus,
            selectedPlan: user.selectedPlan,
            paymentStatus: user.paymentStatus,
            paymentMethod: user.paymentMethod,
            paymentReference: user.paymentReference,
            paymentDate: user.paymentDate,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiry: user.subscriptionExpiry,
        },
        invoice: shapeInvoice(invoice),
        scope,
        token,
        refreshToken,
    }, 'Login successful');
});

/* ============ ME ============ */
const getMe = asyncHandler(async (req, res) => {
    const user = req.user;
    const scope = req.scope;
    let invoice = req.invoice;

    if (invoice) {
        invoice = await withFreshInstructions(invoice);
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
            approvalStatus: user.approvalStatus,
            selectedPlan: user.selectedPlan,
            paymentStatus: user.paymentStatus,
            paymentMethod: user.paymentMethod,
            paymentReference: user.paymentReference,
            paymentDate: user.paymentDate,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionExpiry: user.subscriptionExpiry,
        },
        invoice: shapeInvoice(invoice),
        scope,
    });
});

/* ============ PROFILE ============ */
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

/* ============ FORGOT / RESET ============ */
const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return errorResponse(res, 'Email required', 400);

    const user = await User.findOne({ email });
    if (!user) return successResponse(res, null, 'If that email exists, a reset link has been sent');

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    emailService.send(email, 'farmerPasswordReset', {
        user,
        resetUrl,
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

/* ============ REFRESH ============ */
const refreshTokenHandler = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) return errorResponse(res, 'Refresh token required', 400);

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) return errorResponse(res, 'User not found', 404);

        const newToken = generateToken(user);
        const newRefreshToken = generateRefreshToken(user);
        return successResponse(res, { token: newToken, refreshToken: newRefreshToken }, 'Token refreshed');
    } catch {
        return errorResponse(res, 'Invalid refresh token', 401);
    }
});

module.exports = {
    register,
    login,
    getMe,
    getProfile,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    refreshTokenHandler,
};