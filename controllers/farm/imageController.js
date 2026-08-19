const imageService = require('../../services/imageService');
const limitService = require('../../services/limitService');
const Field = require('../../models/farm/Field');
const TeamMember = require('../../models/farm/TeamMember');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const fs = require('fs');
const path = require('path');
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

    let imagePath = req.file?.path;
    let isDownloaded = false;

    // If image URL provided, download it first
    if (cropImageUrl && !req.file) {
        try {
            const response = await axios.get(cropImageUrl, { 
                responseType: 'arraybuffer',
                timeout: 30000,
            });

            const uploadDir = path.join(__dirname, '../../uploads');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            imagePath = path.join(uploadDir, `url_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`);
            fs.writeFileSync(imagePath, response.data);
            isDownloaded = true;
        } catch (downloadError) {
            logger.error(`Image URL download failed: ${downloadError.message}`);
            return errorResponse(res, 'Failed to download image from URL', 400);
        }
    }

    // Analyze the image
    const result = await imageService.uploadAndAnalyze(imagePath, fieldId, cropType, req.user.id);

    // Clean up temp file if we downloaded it
    if (isDownloaded && imagePath) {
        fs.unlink(imagePath, () => {});
    }

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
        try {
            const { deleteFile } = require('../../config/cloudinary');
            await deleteFile(image.cloudinaryId);
        } catch (error) {
            logger.warn(`Cloudinary delete failed: ${error.message}`);
        }
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