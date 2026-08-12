const alertService = require('../../services/alertService');
const Alert = require('../../models/farm/Alert');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getFarmAlerts = asyncHandler(async (req, res) => {
    const alerts = await alertService.getFarmAlerts(req.params.farmId, req.query.limit);
    return successResponse(res, { alerts });
});

const markAsRead = asyncHandler(async (req, res) => {
    const alert = await alertService.markAsRead(req.params.id);
    if (!alert) return errorResponse(res, 'Alert not found', 404);
    return successResponse(res, { alert }, 'Alert marked as read');
});

const deleteAlert = asyncHandler(async (req, res) => {
    const alert = await Alert.findOneAndDelete({ _id: req.params.id });
    if (!alert) return errorResponse(res, 'Alert not found', 404);
    return successResponse(res, null, 'Alert deleted');
});

const deleteAllAlerts = asyncHandler(async (req, res) => {
    await Alert.deleteMany({ farm: req.params.farmId });
    return successResponse(res, null, 'All alerts deleted');
});

module.exports = { getFarmAlerts, markAsRead, deleteAlert, deleteAllAlerts };