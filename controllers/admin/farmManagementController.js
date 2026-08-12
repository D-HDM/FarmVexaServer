const Farm = require('../../models/farm/Farm');
const FarmManagement = require('../../models/admin/FarmManagement');
const User = require('../../models/farm/User');
const emailService = require('../../services/emailService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getAllFarms = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const query = {};
    if (status) query.status = status;

    const farms = await Farm.find(query)
        .populate('owner', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await Farm.countDocuments(query);

    return successResponse(res, {
        farms,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
});

const getFarmById = asyncHandler(async (req, res) => {
    const farm = await Farm.findById(req.params.id).populate('owner', 'name email phone');
    if (!farm) {
        return errorResponse(res, 'Farm not found', 404);
    }

    const management = await FarmManagement.findOne({ farm: farm._id });

    return successResponse(res, { farm, management });
});

const approveFarm = asyncHandler(async (req, res) => {
    let management = await FarmManagement.findOne({ farm: req.params.id });
    if (!management) {
        management = new FarmManagement({ farm: req.params.id });
    }

    management.status = 'approved';
    management.verifiedBy = req.user.id;
    management.verificationDate = new Date();
    await management.save();

    const farm = await Farm.findById(req.params.id).populate('owner');
    farm.status = 'active';
    await farm.save();

    return successResponse(res, { management }, 'Farm approved');
});

const suspendFarm = asyncHandler(async (req, res) => {
    let management = await FarmManagement.findOne({ farm: req.params.id });
    if (!management) {
        management = new FarmManagement({ farm: req.params.id });
    }

    management.status = 'suspended';
    management.notes = req.body.notes || '';
    await management.save();

    const farm = await Farm.findById(req.params.id);
    farm.status = 'inactive';
    await farm.save();

    return successResponse(res, { management }, 'Farm suspended');
});

const updateSubscription = asyncHandler(async (req, res) => {
    let management = await FarmManagement.findOne({ farm: req.params.id });
    if (!management) {
        management = new FarmManagement({ farm: req.params.id });
    }

    management.subscriptionTier = req.body.tier;
    await management.save();

    return successResponse(res, { management }, 'Subscription updated');
});

module.exports = {
    getAllFarms,
    getFarmById,
    approveFarm,
    suspendFarm,
    updateSubscription,
};