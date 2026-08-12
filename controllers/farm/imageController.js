const imageService = require('../../services/imageService');
const limitService = require('../../services/limitService');
const Field = require('../../models/farm/Field');
const TeamMember = require('../../models/farm/TeamMember');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const uploadAndAnalyze = asyncHandler(async (req, res) => {
    if (!req.file) return errorResponse(res, 'No image file provided', 400);

    const limitCheck = await limitService.checkLimit(req.user.id);
    if (!limitCheck.allowed) return errorResponse(res, limitCheck.reason, 429);

    const { fieldId, cropType } = req.body;
    const result = await imageService.uploadAndAnalyze(req.file.path, fieldId, cropType, req.user.id);

    let farmId = null;
    const field = await Field.findById(fieldId);
    if (field) farmId = field.farm;

    await limitService.logUsage(req.user.id, 'crop_analysis', true, 0, farmId);

    return successResponse(res, { cropImage: result }, 'Image analyzed');
});

const getFieldImages = asyncHandler(async (req, res) => {
    const images = await imageService.getFieldImages(req.params.fieldId, req.query.limit);
    return successResponse(res, { images });
});

const getImageById = asyncHandler(async (req, res) => {
    const image = await imageService.getImageById(req.params.id);
    if (!image) return errorResponse(res, 'Image not found', 404);
    return successResponse(res, { image });
});

module.exports = { uploadAndAnalyze, getFieldImages, getImageById };