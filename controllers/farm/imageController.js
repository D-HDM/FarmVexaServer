const imageService = require('../../services/imageService');
const limitService = require('../../services/limitService');
const Field = require('../../models/farm/Field');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const { deleteFile } = require('../../config/cloudinary');
const axios = require('axios');
const logger = require('../../utils/logger');

const uploadAndAnalyze = asyncHandler(async (req, res) => {
    const { fieldId, cropType, cropImageUrl } = req.body;

    if (!req.file && !cropImageUrl) {
        return errorResponse(res, 'No image file provided', 400);
    }
    if (!fieldId) return errorResponse(res, 'fieldId is required', 400);
    if (!cropType) return errorResponse(res, 'cropType is required', 400);

    const limitCheck = await limitService.checkLimit(req.user.id);
    if (!limitCheck.allowed) return errorResponse(res, limitCheck.reason, 429);

    let buffer;

    if (req.file) {
        buffer = req.file.buffer;
    } else {
        try {
            const response = await axios.get(cropImageUrl, {
                responseType: 'arraybuffer',
                timeout: 30000,
                maxContentLength: 20 * 1024 * 1024,
            });
            buffer = Buffer.from(response.data);
        } catch (err) {
            logger.error(`Image URL download failed: ${err.message}`);
            return errorResponse(res, 'Failed to download image from URL', 400);
        }
    }

    const result = await imageService.uploadAndAnalyze(buffer, fieldId, cropType, req.user.id);

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

const deleteImage = asyncHandler(async (req, res) => {
    const image = await imageService.getImageById(req.params.id);
    if (!image) return errorResponse(res, 'Image not found', 404);

    if (image.cloudinaryId) {
        await deleteFile(image.cloudinaryId, 'image');
    }

    await imageService.deleteImage(req.params.id);
    return successResponse(res, null, 'Image deleted');
});

module.exports = {
    uploadAndAnalyze,
    getFieldImages,
    getImageById,
    deleteImage,
};