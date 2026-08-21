const Settings = require('../../models/admin/Settings');
const VirtualDevice = require('../../models/farm/VirtualDevice');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getVirtualDeviceSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    return successResponse(res, { virtualDevice: settings?.virtualDevice || {} });
});

const updateVirtualDeviceSettings = asyncHandler(async (req, res) => {
    const { enabled, name, intervalMinutes, showForPlans, readings } = req.body;

    const settings = await Settings.findOne();
    if (!settings) return errorResponse(res, 'Settings not found', 404);

    const virtualDevice = settings.virtualDevice || {};

    if (enabled !== undefined) virtualDevice.enabled = enabled;
    if (name) virtualDevice.name = name;
    if (intervalMinutes) virtualDevice.intervalMinutes = intervalMinutes;
    if (showForPlans) virtualDevice.showForPlans = { ...virtualDevice.showForPlans, ...showForPlans };
    if (readings) virtualDevice.readings = readings;

    settings.virtualDevice = virtualDevice;
    settings.updatedBy = req.user.id;
    await settings.save();

    return successResponse(res, { virtualDevice: settings.virtualDevice }, 'Virtual device settings updated');
});

const getVirtualDevices = asyncHandler(async (req, res) => {
    const devices = await VirtualDevice.find()
        .populate('farm', 'name')
        .sort({ createdAt: -1 })
        .lean();
    return successResponse(res, { devices });
});

module.exports = {
    getVirtualDeviceSettings,
    updateVirtualDeviceSettings,
    getVirtualDevices,
};