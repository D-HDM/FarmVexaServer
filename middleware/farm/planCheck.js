const { errorResponse } = require('../../utils/response');
const planService = require('../../services/planService');
const { normalizeFeatures } = require('../../utils/featureKeys');
const logger = require('../../utils/logger');

const FALLBACK_FEATURES = {
    'Basic': ['crop_scan', 'field_scan_manual', 'livestock', 'health', 'production', 'inventory', 'finance', 'weather', 'ai_chat', 'team', 'market', 'reports', 'alerts'],
    'Basic Monthly': ['crop_scan', 'field_scan_manual', 'livestock', 'health', 'production', 'inventory', 'finance', 'weather', 'ai_chat', 'team', 'market', 'reports', 'alerts'],
    'Pro': ['crop_scan', 'field_scan', 'field_scan_manual', 'livestock', 'health', 'production', 'inventory', 'finance', 'weather', 'ai_chat', 'team', 'market', 'reports', 'alerts', 'iot_field_sensors', 'field_scan_gps'],
    'Full Suite': ['crop_scan', 'field_scan', 'field_scan_manual', 'livestock', 'health', 'production', 'inventory', 'finance', 'weather', 'ai_chat', 'team', 'market', 'reports', 'alerts', 'iot_field_sensors', 'field_scan_gps', 'storage_monitoring', 'co2_detection', 'pir_detection'],
};

const planCheck = (feature) => {
    return async (req, res, next) => {
        try {
            const user = req.user;
            const planName = user.selectedPlan || 'Basic';

            let features = null;
            try {
                const plan = await planService.getByName(planName);
                if (plan?.features?.length) {
                    features = normalizeFeatures(plan.features);
                }
            } catch (err) {
                logger.warn(`planCheck DB lookup failed: ${err.message}`);
            }

            if (!features || features.length === 0) {
                features = FALLBACK_FEATURES[planName] || FALLBACK_FEATURES['Basic'];
            }

            if (!features.includes(feature)) {
                return errorResponse(
                    res,
                    `Your plan (${planName}) does not include this feature. Upgrade to access.`,
                    403
                );
            }

            next();
        } catch (err) {
            return errorResponse(res, 'Plan check failed', 500);
        }
    };
};

module.exports = { planCheck, FALLBACK_FEATURES };