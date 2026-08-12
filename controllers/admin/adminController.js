const Admin = require('../../models/admin/Admin');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return errorResponse(res, 'Email and password are required', 400);
    }

    const admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
        return errorResponse(res, 'Invalid credentials', 401);
    }

    if (!admin.isActive) {
        return errorResponse(res, 'Account deactivated', 403);
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
        return errorResponse(res, 'Invalid credentials', 401);
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = generateToken(admin._id, admin.role);
    const refreshToken = generateRefreshToken(admin._id, admin.role);

    return successResponse(res, {
        admin: {
            id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
        },
        token,
        refreshToken,
    }, 'Login successful');
});

const getProfile = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
        return errorResponse(res, 'Admin not found', 404);
    }
    return successResponse(res, { admin });
});

const updateProfile = asyncHandler(async (req, res) => {
    const { name, phone } = req.body;
    const admin = await Admin.findByIdAndUpdate(
        req.user.id,
        { name, phone },
        { new: true, runValidators: true }
    );
    return successResponse(res, { admin }, 'Profile updated');
});

const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.user.id).select('+password');

    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
        return errorResponse(res, 'Current password is incorrect', 400);
    }

    admin.password = newPassword;
    await admin.save();

    return successResponse(res, null, 'Password changed successfully');
});

const createAdmin = asyncHandler(async (req, res) => {
    const { name, email, password, role, phone } = req.body;

    const existing = await Admin.findOne({ email });
    if (existing) {
        return errorResponse(res, 'Email already exists', 400);
    }

    const admin = await Admin.create({ name, email, password, role, phone });

    return successResponse(res, {
        admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    }, 'Admin created successfully');
});

const getAllAdmins = asyncHandler(async (req, res) => {
    const admins = await Admin.find().select('-password');
    return successResponse(res, { admins });
});

const toggleAdminStatus = asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.params.id);
    if (!admin) {
        return errorResponse(res, 'Admin not found', 404);
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    return successResponse(res, { admin }, `Admin ${admin.isActive ? 'activated' : 'deactivated'}`);
});

const deleteAdmin = asyncHandler(async (req, res) => {
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) {
        return errorResponse(res, 'Admin not found', 404);
    }
    return successResponse(res, null, 'Admin deleted');
});

module.exports = {
    login,
    getProfile,
    updateProfile,
    changePassword,
    createAdmin,
    getAllAdmins,
    toggleAdminStatus,
    deleteAdmin,
};