const router = require('express').Router();
const aiService = require('../../services/aiService');
const sensorService = require('../../services/sensorService');
const limitService = require('../../services/limitService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const internalAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.INTERNAL_API_KEY) {
        return errorResponse(res, 'Unauthorized', 401);
    }
    next();
};

router.use(internalAuth);

router.post('/ai/chat', asyncHandler(async (req, res) => {
    const { message, userId } = req.body;

    const limitCheck = await limitService.checkLimit(userId);
    if (!limitCheck.allowed) {
        return errorResponse(res, limitCheck.reason, 429);
    }

    const result = await aiService.farmerChat(message);
    await limitService.logUsage(userId, 'chat', result.success);

    return successResponse(res, result.data || result);
}));

router.post('/ai/analyze-crop', asyncHandler(async (req, res) => {
    const { imagePath, cropType, fieldId, userId } = req.body;

    const limitCheck = await limitService.checkLimit(userId);
    if (!limitCheck.allowed) {
        return errorResponse(res, limitCheck.reason, 429);
    }

    const result = await aiService.analyzeCropImage(imagePath, cropType);
    await limitService.logUsage(userId, 'crop_analysis', result.success);

    return successResponse(res, result.data || result);
}));

router.post('/ai/analyze-sensors', asyncHandler(async (req, res) => {
    const result = await aiService.analyzeSensors(
        req.body.readings,
        req.body.historicalData
    );
    return successResponse(res, result.data || result);
}));

router.post('/sensors/ingest', asyncHandler(async (req, res) => {
    const reading = await sensorService.processSensorData(req.body);
    return successResponse(res, { reading }, 'Sensor data ingested');
}));

router.get('/ai/health', asyncHandler(async (req, res) => {
    const health = await aiService.checkHealth();
    return successResponse(res, health);
}));

router.get('/ai/models', asyncHandler(async (req, res) => {
    const models = await aiService.getModelDetails();
    return successResponse(res, models.data || models);
}));

router.post('/ai/train', asyncHandler(async (req, res) => {
    const result = await aiService.trainModel(req.body);
    return successResponse(res, result.data || result);
}));

router.get('/limits/check/:userId', asyncHandler(async (req, res) => {
    const check = await limitService.checkLimit(req.params.userId);
    return successResponse(res, check);
}));

module.exports = router;