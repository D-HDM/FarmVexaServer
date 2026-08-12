const User = require('../../models/farm/User');
const Farm = require('../../models/farm/Farm');
const emailService = require('../../services/emailService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getAllUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const query = { role: 'farmer' };

    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (status === 'pending') query.approvalStatus = 'pending';
    if (status === 'approved') query.approvalStatus = 'approved';
    if (status === 'rejected') query.approvalStatus = 'rejected';

    const users = await User.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const usersWithFarms = await Promise.all(
        users.map(async (user) => {
            const farmCount = await Farm.countDocuments({ owner: user._id });
            return { ...user, farmCount };
        })
    );

    const total = await User.countDocuments(query);

    return successResponse(res, {
        users: usersWithFarms,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }

    const farms = await Farm.find({ owner: user._id });

    return successResponse(res, { user, farms });
});

const toggleUserStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }

    user.isActive = !user.isActive;
    await user.save();

    return successResponse(res, { user }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
});

const deleteUser = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
        return errorResponse(res, 'User not found', 404);
    }

    await Farm.deleteMany({ owner: user._id });

    return successResponse(res, null, 'User and associated farms deleted');
});

module.exports = {
    getAllUsers,
    getUserById,
    toggleUserStatus,
    deleteUser,
};