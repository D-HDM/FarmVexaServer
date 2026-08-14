const fieldScanService = require('../../services/fieldScanService');
const limitService = require('../../services/limitService');
const Field = require('../../models/farm/Field');
const Settings = require('../../models/admin/Settings');
const Usage = require('../../models/admin/Usage');
const emailService = require('../../services/emailService');
const User = require('../../models/farm/User');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

// Check if field scan is enabled and limits not exceeded
const checkFieldScanAccess = async (userId, fieldId) => {
    const settings = await Settings.findOne();
    const fieldScanSettings = settings?.fieldScan || {};
    
    if (!fieldScanSettings.enabled) {
        return { allowed: false, reason: 'Field scan is currently disabled' };
    }

    // Check daily limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Farmer daily limit
    const farmerDaily = await Usage.countDocuments({
        user: userId,
        endpoint: 'field_scan',
        requestTimestamp: { $gte: today },
    });
    const farmerDailyLimit = fieldScanSettings.farmerLimits?.daily || 10;
    if (farmerDaily >= farmerDailyLimit) {
        return { allowed: false, reason: `Daily field scan limit reached (${farmerDaily}/${farmerDailyLimit})` };
    }

    // Field daily limit
    const fieldDaily = await Usage.countDocuments({
        farm: fieldId,
        endpoint: 'field_scan',
        requestTimestamp: { $gte: today },
    });
    const fieldDailyLimit = fieldScanSettings.fieldLimits?.daily || 10;
    if (fieldDaily >= fieldDailyLimit) {
        return { allowed: false, reason: `Field daily scan limit reached (${fieldDaily}/${fieldDailyLimit})` };
    }

    // Check weekly limits
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const farmerWeekly = await Usage.countDocuments({
        user: userId,
        endpoint: 'field_scan',
        requestTimestamp: { $gte: weekStart },
    });
    const farmerWeeklyLimit = fieldScanSettings.farmerLimits?.weekly || 50;
    if (farmerWeekly >= farmerWeeklyLimit) {
        return { allowed: false, reason: `Weekly field scan limit reached (${farmerWeekly}/${farmerWeeklyLimit})` };
    }

    // Check monthly limits
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const farmerMonthly = await Usage.countDocuments({
        user: userId,
        endpoint: 'field_scan',
        requestTimestamp: { $gte: monthStart },
    });
    const farmerMonthlyLimit = fieldScanSettings.farmerLimits?.monthly || 200;
    if (farmerMonthly >= farmerMonthlyLimit) {
        return { allowed: false, reason: `Monthly field scan limit reached (${farmerMonthly}/${farmerMonthlyLimit})` };
    }

    return { allowed: true };
};

const startFieldScan = asyncHandler(async (req, res) => {
    const { fieldId } = req.body;
    if (!fieldId) return errorResponse(res, 'fieldId is required', 400);

    const field = await Field.findById(fieldId);
    if (!field) return errorResponse(res, 'Field not found', 404);

    const access = await checkFieldScanAccess(req.user.id, fieldId);
    if (!access.allowed) return errorResponse(res, access.reason, 429);

    const farmId = field.farm;

    await limitService.logUsage(req.user.id, 'field_scan', true, 0, farmId, 'fieldscan_primary');

    return successResponse(res, { scanSession: { fieldId, farmId, startedAt: new Date() } }, 'Field scan started', 201);
});

const analyzeFieldScan = asyncHandler(async (req, res) => {
    const { fieldId, cropType, frames, maxGeminiCalls, preFilterEnabled } = req.body;

    if (!fieldId) return errorResponse(res, 'fieldId is required', 400);
    if (!cropType) return errorResponse(res, 'cropType is required', 400);
    if (!frames || frames.length === 0) return errorResponse(res, 'frames are required', 400);

    const field = await Field.findById(fieldId);
    if (!field) return errorResponse(res, 'Field not found', 404);

    const farmId = field.farm;

    // Check field scan settings
    const settings = await Settings.findOne();
    const maxPhotos = settings?.fieldScan?.maxPhotosPerScan || 100;
    if (frames.length > maxPhotos) {
        return errorResponse(res, `Maximum ${maxPhotos} photos per scan`, 400);
    }

    // Check access
    const access = await checkFieldScanAccess(req.user.id, fieldId);
    if (!access.allowed) return errorResponse(res, access.reason, 429);

    // Call Python AI
    const aiResult = await fieldScanService.analyzeFieldScan(
        frames,
        cropType,
        fieldId,
        maxGeminiCalls || settings?.fieldScan?.maxGeminiCallsPerScan || 30,
        preFilterEnabled ?? settings?.fieldScan?.preFilterEnabled ?? true
    );

    if (!aiResult.success) {
        return errorResponse(res, aiResult.message || 'Field scan analysis failed', 500);
    }

    // Log usage with key info
    const keyUsage = aiResult.data?.keyUsage || {};
    const analyzedFrames = aiResult.data?.analyzedFrames || 0;

    await limitService.logUsage(
        req.user.id,
        'field_scan',
        true,
        analyzedFrames,
        farmId,
        keyUsage.fieldscan_backup > keyUsage.fieldscan_primary ? 'fieldscan_backup' : 'fieldscan_primary'
    );

    // Send email notification
    try {
        const emailToggles = settings?.emailToggles || {};
        if (emailToggles.farmerFieldScanResults !== false) {
            const user = await User.findById(req.user.id);
            const summary = aiResult.data?.summary || {};
            
            await emailService.send(
                user.email,
                'farmerFieldScanResults',
                {
                    user: { name: user.name, email: user.email },
                    fieldName: field.name,
                    cropType,
                    scanDate: new Date(),
                    duration: null,
                    totalPhotos: frames.length,
                    analyzedPhotos: analyzedFrames,
                    coverage: null,
                    healthyCount: summary.healthyCount || 0,
                    healthyPercentage: summary.healthyPercentage || 0,
                    diseaseCount: summary.diseaseCount || 0,
                    diseases: summary.diseases || [],
                    weeds: summary.weeds || { pressure: 'None', hotspots: [] },
                    pests: summary.pests || { activity: 'None', affectedAreas: 0 },
                    recommendations: (aiResult.data?.results || [])
                        .filter((r) => r.analysis?.recommendation)
                        .map((r) => r.analysis.recommendation)
                        .slice(0, 5) || [],
                    scanId: null,
                }
            );
        }
    } catch (emailError) {
        logger.error(`Field scan email failed: ${emailError.message}`);
        // Don't block the response — email is non-critical
    }

    return successResponse(res, aiResult.data, 'Field scan analysis complete');
});

const getFieldScanSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    const fieldScan = settings?.fieldScan || {};

    return successResponse(res, {
        enabled: fieldScan.enabled ?? false,
        maxPhotosPerScan: fieldScan.maxPhotosPerScan ?? 100,
        captureInterval: fieldScan.captureInterval ?? 5,
        farmerLimits: fieldScan.farmerLimits || { daily: 10, weekly: 50, monthly: 200 },
        fieldLimits: fieldScan.fieldLimits || { daily: 10, weekly: 50, monthly: 200 },
        allowedCropTypes: fieldScan.allowedCropTypes || [],
        requireGpsAccuracy: fieldScan.requireGpsAccuracy ?? 15,
        preFilterEnabled: fieldScan.preFilterEnabled ?? true,
        maxGeminiCallsPerScan: fieldScan.maxGeminiCallsPerScan ?? 30,
        minPhotoSize: fieldScan.minPhotoSize ?? 50,
        maxPhotoSize: fieldScan.maxPhotoSize ?? 500,
    });
});

const getMyFieldScans = asyncHandler(async (req, res) => {
    const scans = await Usage.find({ user: req.user.id, endpoint: 'field_scan' })
        .sort({ requestTimestamp: -1 })
        .limit(20)
        .lean();
    return successResponse(res, { scans });
});

module.exports = {
    startFieldScan,
    analyzeFieldScan,
    getFieldScanSettings,
    getMyFieldScans,
};