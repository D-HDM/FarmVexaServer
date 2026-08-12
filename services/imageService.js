const CropImage = require('../models/farm/CropImage');
const SensorReading = require('../models/farm/SensorReading');
const Field = require('../models/farm/Field');
const aiService = require('./aiService');
const alertService = require('./alertService');
const { uploadFile, deleteFile } = require('../config/cloudinary');
const logger = require('../utils/logger');

class ImageService {
    async uploadAndAnalyze(imagePath, fieldId, cropType, userId) {
        const uploadResult = await uploadFile(imagePath, {
            folder: `farmvexa/${fieldId}`,
        });

        const field = await Field.findById(fieldId);
        const farmId = field?.farm;

        const cropImage = await CropImage.create({
            field: fieldId,
            cropType,
            imageUrl: uploadResult.url,
            storageType: uploadResult.storage,
            cloudinaryId: uploadResult.public_id,
            status: 'analyzing',
        });

        try {
            const latestReading = await SensorReading.findOne({ field: fieldId })
                .sort({ timestamp: -1 })
                .lean();

            const aiResult = await aiService.analyzeCropImage(
                imagePath,
                cropType,
                latestReading
            );

            if (aiResult.success && aiResult.data) {
                const analysis = aiResult.data.image_analysis || aiResult.data;

                cropImage.diseaseDetected = analysis.disease;
                cropImage.confidence = analysis.confidence;
                cropImage.severity = analysis.severity || 'low';
                cropImage.symptoms = analysis.symptoms;
                cropImage.recommendation = analysis.recommendation;
                cropImage.healthScore = aiResult.data.health_score;
                cropImage.aiUsed = process.env.AI_USED || 'gemini';
                cropImage.status = 'completed';
                cropImage.analysisTimestamp = new Date();
                await cropImage.save();

                if (analysis.disease && analysis.disease !== 'Healthy') {
                    const severityMap = {
                        low: 'low',
                        moderate: 'medium',
                        medium: 'medium',
                        high: 'high',
                        critical: 'critical',
                    };

                    await alertService.createAlert({
                        farm: farmId,
                        field: fieldId,
                        type: 'disease_detected',
                        severity: severityMap[analysis.severity] || 'medium',
                        message: `${analysis.disease} detected on ${cropType}`,
                        recommendation: analysis.recommendation,
                        data: {
                            disease: analysis.disease,
                            confidence: analysis.confidence,
                            severity: analysis.severity,
                            cropType,
                            imageId: cropImage._id,
                        },
                    });
                }
            } else {
                cropImage.status = 'failed';
                await cropImage.save();
            }
        } catch (error) {
            cropImage.status = 'failed';
            await cropImage.save();
            logger.error(`Image analysis failed: ${error.message}`);
        }

        return cropImage;
    }

    async getFieldImages(fieldId, limit = 20) {
        return CropImage.find({ field: fieldId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    async getImageById(imageId) {
        return CropImage.findById(imageId).lean();
    }
}

module.exports = new ImageService();