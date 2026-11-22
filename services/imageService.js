const CropImage = require('../models/farm/CropImage');
const SensorReading = require('../models/farm/SensorReading');
const Field = require('../models/farm/Field');
const aiService = require('./aiService');
const alertService = require('./alertService');
const { uploadFile } = require('../config/cloudinary');
const { classifyDisease, CATEGORIES } = require('../utils/diseaseClassifier');
const logger = require('../utils/logger');

const ALLOWED_SEVERITY = ['low', 'moderate', 'high', 'uncertain', 'none'];

function normalizeSeverity(raw) {
    if (raw === null || raw === undefined) return 'uncertain';
    const value = String(raw).trim().toLowerCase();
    if (ALLOWED_SEVERITY.includes(value)) return value;
    if (value === 'medium' || value === 'medium_severity') return 'moderate';
    if (value === 'healthy' || value === 'n/a' || value === 'na') return 'none';
    if (value === 'critical' || value === 'severe') return 'high';
    return 'uncertain';
}

function normalizeAlertSeverity(raw) {
    if (raw === null || raw === undefined) return 'medium';
    const value = String(raw).trim().toLowerCase();
    if (['low', 'medium', 'high', 'critical'].includes(value)) return value;
    if (value === 'moderate') return 'medium';
    if (value === 'uncertain' || value === 'none' || value === 'healthy' || value === 'n/a' || value === 'na') return 'low';
    if (value === 'severe') return 'high';
    return 'medium';
}

function safeString(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const s = String(value).trim();
    return s.length ? s : fallback;
}

class ImageService {
    async uploadAndAnalyze(imageBuffer, fieldId, cropType, userId) {
        const uploadResult = await uploadFile(imageBuffer, {
            folder: `farmvexa/${fieldId}`,
            resource_type: 'image',
        });

        const field = await Field.findById(fieldId);
        const farmId = field?.farm;

        const cropImage = await CropImage.create({
            field: fieldId,
            cropType,
            imageUrl: uploadResult.url,
            storageType: 'cloudinary',
            cloudinaryId: uploadResult.public_id,
            status: 'analyzing',
        });

        try {
            const latestReading = await SensorReading.findOne({ field: fieldId })
                .sort({ timestamp: -1 })
                .lean();

            const aiResult = await aiService.analyzeCropImage(imageBuffer, cropType, latestReading);

            if (aiResult && aiResult.success && aiResult.data) {
                const analysis = aiResult.data.image_analysis || aiResult.data;

                // ---- Classify disease via shared classifier ----
                const classification = classifyDisease(analysis.disease);
                cropImage.diseaseDetected = classification.value;
                cropImage.diseaseCategory = classification.category;

                cropImage.confidence = typeof analysis.confidence === 'number' ? analysis.confidence : null;
                cropImage.severity = normalizeSeverity(analysis.severity);
                cropImage.symptoms = safeString(
                    analysis.symptoms || (classification.category !== CATEGORIES.DISEASE ? classification.raw : ''),
                    ''
                );
                cropImage.recommendation = safeString(analysis.recommendation, '');
                cropImage.healthScore = typeof aiResult.data.health_score === 'number' ? aiResult.data.health_score : null;

                // Provider from FastAPI's response (was process.env.AI_USED before)
                const providerRaw = analysis.keyUsed || analysis.model || '';
                cropImage.aiUsed = safeString(providerRaw, 'unknown');

                cropImage.status = 'completed';
                cropImage.analysisTimestamp = new Date();
                await cropImage.save();

                // ---- Alerts ONLY for real diseases ----
                if (classification.category === CATEGORIES.DISEASE) {
                    await alertService.createAlert({
                        farm: farmId,
                        field: fieldId,
                        type: 'disease_detected',
                        severity: normalizeAlertSeverity(analysis.severity),
                        message: `${classification.value} detected on ${cropType}`,
                        recommendation: cropImage.recommendation,
                        data: {
                            disease: classification.value,
                            confidence: cropImage.confidence,
                            severity: cropImage.severity,
                            cropType,
                            imageId: cropImage._id,
                            provider: cropImage.aiUsed,
                        },
                    });
                } else {
                    logger.info(
                        `[ImageService] No alert for image ${cropImage._id} — category=${classification.category}`
                    );
                }
            } else {
                cropImage.status = 'failed';
                cropImage.severity = 'uncertain';
                cropImage.diseaseDetected = 'Analysis failed';
                cropImage.diseaseCategory = CATEGORIES.INCONCLUSIVE;
                cropImage.recommendation = 'AI did not return a result. Please retry the scan.';
                await cropImage.save();
                logger.warn(`Image analysis returned no data for ${cropImage._id}`);
            }
        } catch (error) {
            cropImage.status = 'failed';
            cropImage.severity = 'uncertain';
            cropImage.diseaseDetected = 'Analysis failed';
            cropImage.diseaseCategory = CATEGORIES.INCONCLUSIVE;
            cropImage.recommendation = 'AI call failed. Please retry the scan.';
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

    async deleteImage(imageId) {
        return CropImage.findByIdAndDelete(imageId);
    }
}

module.exports = new ImageService();