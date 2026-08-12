const Usage = require('../../models/admin/Usage');
const Farm = require('../../models/farm/Farm');
const User = require('../../models/farm/User');
const limitService = require('../../services/limitService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getTotalUsage = asyncHandler(async (req, res) => {
    const usage = await limitService.getTotalUsage();
    return successResponse(res, { usage });
});

const getAllFarmsUsage = asyncHandler(async (req, res) => {
    const farms = await Farm.find().lean();

    const usageData = [];
    for (const farm of farms) {
        const usage = await limitService.getFarmUsage(farm._id);
        usageData.push({ farm: { id: farm._id, name: farm.name }, usage });
    }

    usageData.sort((a, b) => b.usage.today - a.usage.today);
    return successResponse(res, { farms: usageData });
});

const getFarmUsage = asyncHandler(async (req, res) => {
    const usage = await limitService.getFarmUsage(req.params.id);
    const history = await Usage.find({ farm: req.params.id }).populate('user', 'name email').sort({ requestTimestamp: -1 }).limit(50);
    const farm = await Farm.findById(req.params.id);
    return successResponse(res, { farm, usage, history });
});

const getUserUsage = asyncHandler(async (req, res) => {
    const usage = await limitService.getUserUsage(req.params.id);
    const history = await Usage.find({ user: req.params.id }).sort({ requestTimestamp: -1 }).limit(50);
    return successResponse(res, { usage, history });
});

const updateLimits = asyncHandler(async (req, res) => {
    const Settings = require('../../models/admin/Settings');
    const { dailyLimitPerUser, dailyLimitTotal } = req.body;
    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();
    if (dailyLimitPerUser) settings.gemini.dailyLimitPerUser = dailyLimitPerUser;
    if (dailyLimitTotal) settings.gemini.dailyLimitTotal = dailyLimitTotal;
    settings.updatedBy = req.user.id;
    await settings.save();
    return successResponse(res, { settings }, 'Limits updated');
});

module.exports = { getTotalUsage, getAllFarmsUsage, getFarmUsage, getUserUsage, updateLimits };