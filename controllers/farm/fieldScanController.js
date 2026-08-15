const fieldScanService = require('../../services/fieldScanService');
const limitService = require('../../services/limitService');
const Field = require('../../models/farm/Field');
const FieldScan = require('../../models/farm/FieldScan');
const Settings = require('../../models/admin/Settings');
const Usage = require('../../models/admin/Usage');
const emailService = require('../../services/emailService');
const alertService = require('../../services/alertService');
const User = require('../../models/farm/User');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const checkFieldScanAccess = async (userId, fieldId) => {
    const settings = await Settings.findOne();
    const fieldScanSettings = settings?.fieldScan || {};
    
    if (!fieldScanSettings.enabled) {
        return { allowed: false, reason: 'Field scan is currently disabled' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const farmerDaily = await Usage.countDocuments({
        user: userId,
        endpoint: 'field_scan',
        requestTimestamp: { $gte: today },
    });
    const farmerDailyLimit = fieldScanSettings.farmerLimits?.daily || 10;
    if (farmerDaily >= farmerDailyLimit) {
        return { allowed: false, reason: `Daily field scan limit reached (${farmerDaily}/${farmerDailyLimit})` };
    }

    const fieldDaily = await Usage.countDocuments({
        farm: fieldId,
        endpoint: 'field_scan',
        requestTimestamp: { $gte: today },
    });
    const fieldDailyLimit = fieldScanSettings.fieldLimits?.daily || 10;
    if (fieldDaily >= fieldDailyLimit) {
        return { allowed: false, reason: `Field daily scan limit reached (${fieldDaily}/${fieldDailyLimit})` };
    }

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

    const scan = await FieldScan.create({
        user: req.user.id,
        farm: farmId,
        field: fieldId,
        cropType: req.body.cropType || '',
        status: 'processing',
    });

    await limitService.logUsage(req.user.id, 'field_scan', true, 0, farmId, 'fieldscan_primary', { scanStatus: 'started', scanId: scan._id });

    return successResponse(res, { scanSession: { scanId: scan._id, fieldId, farmId, startedAt: new Date() } }, 'Field scan started', 201);
});

const analyzeFieldScan = asyncHandler(async (req, res) => {
    const { fieldId, cropType, frames, maxGeminiCalls, preFilterEnabled, preFilterPercentage } = req.body;

    if (!fieldId) return errorResponse(res, 'fieldId is required', 400);
    if (!cropType) return errorResponse(res, 'cropType is required', 400);
    if (!frames || frames.length === 0) return errorResponse(res, 'frames are required', 400);

    const field = await Field.findById(fieldId);
    if (!field) return errorResponse(res, 'Field not found', 404);

    const farmId = field.farm;

    const settings = await Settings.findOne();
    const maxPhotos = settings?.fieldScan?.maxPhotosPerScan || 100;
    if (frames.length > maxPhotos) {
        return errorResponse(res, `Maximum ${maxPhotos} photos per scan`, 400);
    }

    const access = await checkFieldScanAccess(req.user.id, fieldId);
    if (!access.allowed) return errorResponse(res, access.reason, 429);

    // Create scan record
    const scan = await FieldScan.create({
        user: req.user.id,
        farm: farmId,
        field: fieldId,
        cropType,
        totalFrames: frames.length,
        status: 'processing',
    });

    // Call Python AI
    let aiResult;
    try {
        aiResult = await fieldScanService.analyzeFieldScan(
            frames,
            cropType,
            fieldId,
            maxGeminiCalls || settings?.fieldScan?.maxGeminiCallsPerScan || 30,
            preFilterEnabled ?? settings?.fieldScan?.preFilterEnabled ?? true,
            preFilterPercentage || settings?.fieldScan?.preFilterPercentage || 60
        );
    } catch (aiError) {
        scan.status = 'failed';
        scan.errorMessage = aiError.message;
        await scan.save();
        
        await limitService.logUsage(req.user.id, 'field_scan', false, 0, farmId, 'fieldscan_primary', { scanId: scan._id, error: aiError.message });
        
        return errorResponse(res, aiError.message || 'Field scan analysis failed', 500);
    }

    if (!aiResult.success) {
        scan.status = 'failed';
        scan.errorMessage = aiResult.message || 'Analysis failed';
        await scan.save();
        
        await limitService.logUsage(req.user.id, 'field_scan', false, 0, farmId, 'fieldscan_primary', { scanId: scan._id, error: aiResult.message });
        
        return errorResponse(res, aiResult.message || 'Field scan analysis failed', 500);
    }

    // Update scan with results
    const data = aiResult.data || {};
    const keyUsage = data.keyUsage || {};
    const analyzedFrames = data.analyzedFrames || 0;

    scan.status = 'completed';
    scan.totalFrames = data.totalFrames || frames.length;
    scan.preFilteredFrames = data.preFilteredFrames || 0;
    scan.skippedFrames = data.skippedFrames || 0;
    scan.analyzedFrames = analyzedFrames;
    scan.geminiRequests = data.geminiRequests || 0;
    scan.batchSize = data.batchSize || 16;
    scan.duration = data.duration || 0;
    scan.skipReasons = data.skipReasons || {};
    scan.photos = data.results || [];
    scan.summary = data.summary || {};
    scan.keyUsage = keyUsage;
    await scan.save();

    // === CREATE ALERTS FOR DISEASES ===
    if (scan.summary?.diseases?.length > 0) {
        try {
            const severityMap = {
                low: 'low',
                moderate: 'medium',
                medium: 'medium',
                high: 'high',
                critical: 'critical',
            };

            // Deduplicate by disease name
            const uniqueDiseases = [...new Set(scan.summary.diseases.map(d => d.name))];
            
            for (const diseaseName of uniqueDiseases) {
                const diseaseInstances = scan.summary.diseases.filter(d => d.name === diseaseName);
                
                // Get highest severity
                const severityOrder = { low: 0, moderate: 1, medium: 1, high: 2, critical: 3 };
                const highestSeverity = diseaseInstances.reduce((max, d) => {
                    return severityOrder[d.severity] > severityOrder[max] ? d.severity : max;
                }, 'low');

                await alertService.createAlert({
                    farm: farmId,
                    field: fieldId,
                    type: 'disease_detected',
                    severity: severityMap[highestSeverity] || 'medium',
                    message: `${diseaseName} detected in field scan (${diseaseInstances.length} photos affected)`,
                    recommendation: diseaseInstances[0]?.recommendation || 'Inspect affected areas and apply appropriate treatment.',
                    data: {
                        disease: diseaseName,
                        count: diseaseInstances.length,
                        cropType,
                        scanId: scan._id,
                        locations: diseaseInstances.map(d => d.location),
                    },
                });
            }
            
            logger.info(`[Field Scan] Created ${uniqueDiseases.length} disease alerts for scan ${scan._id}`);
        } catch (alertError) {
            logger.error(`[Field Scan] Alert creation failed: ${alertError.message}`);
        }
    }

    // Log usage with full metadata
    const metadata = {
        scanId: scan._id,
        totalFrames: scan.totalFrames,
        preFilteredFrames: scan.preFilteredFrames,
        skippedFrames: scan.skippedFrames,
        geminiRequests: scan.geminiRequests,
        batchSize: scan.batchSize,
        duration: scan.duration,
        skipReasons: scan.skipReasons,
    };

    await limitService.logUsage(
        req.user.id,
        'field_scan',
        true,
        analyzedFrames,
        farmId,
        keyUsage.fieldscan_backup > keyUsage.fieldscan_primary ? 'fieldscan_backup' : 'fieldscan_primary',
        metadata
    );

    // Send email
    try {
        const emailToggles = settings?.emailToggles || {};
        if (emailToggles.farmerFieldScanResults !== false) {
            const user = await User.findById(req.user.id);
            const summary = scan.summary || {};
            
            await emailService.send(
                user.email,
                'farmerFieldScanResults',
                {
                    user: { name: user.name, email: user.email },
                    fieldName: field.name,
                    cropType,
                    scanDate: new Date(),
                    duration: scan.duration ? `${scan.duration}s` : null,
                    totalPhotos: scan.totalFrames,
                    analyzedPhotos: scan.analyzedFrames,
                    coverage: null,
                    healthyCount: summary.healthyCount || 0,
                    healthyPercentage: summary.healthyPercentage || 0,
                    diseaseCount: summary.diseaseCount || 0,
                    diseases: summary.diseases || [],
                    weeds: summary.weeds || { pressure: 'None', hotspots: [] },
                    pests: summary.pests || { activity: 'None', affectedAreas: 0 },
                    recommendations: (scan.photos || [])
                        .filter((p) => p.analysis?.recommendation)
                        .map((p) => p.analysis.recommendation)
                        .slice(0, 5) || [],
                    scanId: scan._id,
                }
            );

            scan.emailSent = true;
            await scan.save();
        }
    } catch (emailError) {
        logger.error(`Field scan email failed: ${emailError.message}`);
    }

    return successResponse(res, { ...data, scanId: scan._id }, 'Field scan analysis complete');
});

const getFieldScanSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    const fieldScan = settings?.fieldScan || {};

    return successResponse(res, {
        enabled: fieldScan.enabled ?? false,
        maxPhotosPerScan: fieldScan.maxPhotosPerScan ?? 100,
        captureInterval: fieldScan.captureInterval ?? 5,
        preFilterPercentage: fieldScan.preFilterPercentage ?? 60,
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
    const scans = await FieldScan.find({ user: req.user.id })
        .populate('field', 'name')
        .populate('farm', 'name')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    return successResponse(res, { scans });
});

const getFieldScanById = asyncHandler(async (req, res) => {
    const scan = await FieldScan.findOne({ _id: req.params.id, user: req.user.id })
        .populate('field', 'name')
        .populate('farm', 'name')
        .lean();
    if (!scan) return errorResponse(res, 'Scan not found', 404);
    return successResponse(res, { scan });
});

const getFieldScansByField = asyncHandler(async (req, res) => {
    const scans = await FieldScan.find({ field: req.params.fieldId, user: req.user.id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    return successResponse(res, { scans });
});

const deleteFieldScan = asyncHandler(async (req, res) => {
    const scan = await FieldScan.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!scan) return errorResponse(res, 'Scan not found', 404);
    return successResponse(res, null, 'Scan deleted');
});

module.exports = {
    startFieldScan,
    analyzeFieldScan,
    getFieldScanSettings,
    getMyFieldScans,
    getFieldScanById,
    getFieldScansByField,
    deleteFieldScan,
};