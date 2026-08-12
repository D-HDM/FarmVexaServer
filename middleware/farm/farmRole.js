const { errorResponse } = require('../../utils/response');

const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) {
        return errorResponse(res, 'Insufficient permissions', 403);
    }
    next();
};

const isFarmer = (req, res, next) => {
    if (req.user.role !== 'farmer') return errorResponse(res, 'Farmer access only', 403);
    next();
};

const isFarmerOrManager = (req, res, next) => {
    if (!['farmer', 'manager'].includes(req.user.role)) return errorResponse(res, 'Access denied', 403);
    next();
};

const canManageLivestock = (req, res, next) => {
    if (!['farmer', 'manager'].includes(req.user.role)) return errorResponse(res, 'Access denied', 403);
    next();
};

const canManageHealth = (req, res, next) => {
    if (!['farmer', 'vet', 'manager'].includes(req.user.role)) return errorResponse(res, 'Access denied', 403);
    next();
};

const canRecordProduction = (req, res, next) => {
    if (!['farmer', 'worker', 'manager'].includes(req.user.role)) return errorResponse(res, 'Access denied', 403);
    next();
};

const canManageInventory = (req, res, next) => {
    if (!['farmer', 'manager'].includes(req.user.role)) return errorResponse(res, 'Access denied', 403);
    next();
};

const canAccessFinance = (req, res, next) => {
    if (!['farmer', 'manager'].includes(req.user.role)) return errorResponse(res, 'Access denied', 403);
    next();
};

const canManageTeam = (req, res, next) => {
    if (req.user.role !== 'farmer') return errorResponse(res, 'Farmer access only', 403);
    next();
};

const canManageTasks = (req, res, next) => {
    if (!['farmer', 'manager'].includes(req.user.role)) return errorResponse(res, 'Access denied', 403);
    next();
};

const canManageDevices = (req, res, next) => {
    if (!['farmer', 'manager'].includes(req.user.role)) return errorResponse(res, 'Access denied', 403);
    next();
};

module.exports = {
    requireRole, isFarmer, isFarmerOrManager,
    canManageLivestock, canManageHealth, canRecordProduction,
    canManageInventory, canAccessFinance, canManageTeam,
    canManageTasks, canManageDevices,
};