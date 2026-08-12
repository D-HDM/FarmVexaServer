const sensorService = require('../../services/sensorService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const receiveSensorData = asyncHandler(async (req, res) => {
    const reading = await sensorService.processSensorData(req.body);
    return successResponse(res, { reading }, 'Sensor data received', 201);
});

const getFieldReadings = asyncHandler(async (req, res) => {
    const readings = await sensorService.getFieldReadings(req.params.fieldId, req.query.limit);
    return successResponse(res, { readings });
});

const getDeviceReadings = asyncHandler(async (req, res) => {
    const readings = await sensorService.getDeviceReadings(req.params.deviceId, req.query.limit);
    return successResponse(res, { readings });
});

module.exports = {
    receiveSensorData,
    getFieldReadings,
    getDeviceReadings,
};