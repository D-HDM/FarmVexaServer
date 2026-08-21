const Device = require('../../models/farm/Device');
const VirtualDevice = require('../../models/farm/VirtualDevice');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const VALID_ZONES = ['field', 'storage', 'greenhouse', 'livestock'];
const VALID_SENSOR_TYPES = ['dht', 'soil', 'co2', 'pir', 'acoustic', 'camera', 'weight'];

const registerDevice = asyncHandler(async (req, res) => {
    const existing = await Device.findOne({ deviceId: req.body.deviceId });
    if (existing) {
        return errorResponse(res, 'Device ID already registered', 400);
    }

    if (req.body.zone && !VALID_ZONES.includes(req.body.zone)) {
        return errorResponse(res, `Invalid zone. Allowed: ${VALID_ZONES.join(', ')}`, 400);
    }

    if (req.body.sensorType && !VALID_SENSOR_TYPES.includes(req.body.sensorType)) {
        return errorResponse(res, `Invalid sensorType. Allowed: ${VALID_SENSOR_TYPES.join(', ')}`, 400);
    }

    if (req.body.zone === 'storage' && !req.body.field) {
        req.body.field = null;
    }

    if (req.body.zone !== 'storage' && !req.body.field && !req.body.fieldId) {
        return errorResponse(res, 'Field is required for non-storage devices', 400);
    }

    const device = await Device.create({
        ...req.body,
        farm: req.params.farmId,
    });
    return successResponse(res, { device }, 'Device registered', 201);
});

const getFarmDevices = asyncHandler(async (req, res) => {
    const devices = await Device.find({ farm: req.params.farmId });
    return successResponse(res, { devices });
});

const getDeviceById = asyncHandler(async (req, res) => {
    // Check physical device first
    let device = await Device.findById(req.params.id).populate('field farm');

    // If not physical, check virtual device
    if (!device) {
        const virtualDevice = await VirtualDevice.findById(req.params.id).populate('farm');
        if (virtualDevice) {
            return successResponse(res, {
                device: {
                    ...virtualDevice.toObject(),
                    deviceId: virtualDevice.name,
                    isVirtualDevice: true,
                },
            });
        }
    }

    if (!device) return errorResponse(res, 'Device not found', 404);
    return successResponse(res, { device });
});

const updateDevice = asyncHandler(async (req, res) => {
    if (req.body.zone && !VALID_ZONES.includes(req.body.zone)) {
        return errorResponse(res, `Invalid zone. Allowed: ${VALID_ZONES.join(', ')}`, 400);
    }

    if (req.body.sensorType && !VALID_SENSOR_TYPES.includes(req.body.sensorType)) {
        return errorResponse(res, `Invalid sensorType. Allowed: ${VALID_SENSOR_TYPES.join(', ')}`, 400);
    }

    if (req.body.zone === 'storage') {
        req.body.field = req.body.field || null;
    }

    const device = await Device.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });
    if (!device) return errorResponse(res, 'Device not found', 404);
    return successResponse(res, { device }, 'Device updated');
});

const deleteDevice = asyncHandler(async (req, res) => {
    // Check if it's a virtual device
    const virtualDevice = await VirtualDevice.findById(req.params.id);
    if (virtualDevice) {
        return errorResponse(res, 'Virtual devices cannot be deleted', 400);
    }

    const device = await Device.findByIdAndDelete(req.params.id);
    if (!device) return errorResponse(res, 'Device not found', 404);
    return successResponse(res, null, 'Device deleted');
});

module.exports = {
    registerDevice,
    getFarmDevices,
    getDeviceById,
    updateDevice,
    deleteDevice,
};