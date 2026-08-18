const { errorResponse } = require('../../utils/response');

// Feature access per plan
const planFeatures = {
    'Basic': [
        'crop_scan',
        'field_scan_manual',
        'livestock',
        'health',
        'production',
        'inventory',
        'finance',
        'weather',
        'ai_chat',
        'team',
        'market',
        'reports',
        'alerts',
    ],
    'Basic Monthly': [
        'crop_scan',
        'field_scan_manual',
        'livestock',
        'health',
        'production',
        'inventory',
        'finance',
        'weather',
        'ai_chat',
        'team',
        'market',
        'reports',
        'alerts',
    ],
    'Pro': [
        'crop_scan',
        'field_scan',
        'field_scan_manual',
        'livestock',
        'health',
        'production',
        'inventory',
        'finance',
        'weather',
        'ai_chat',
        'team',
        'market',
        'reports',
        'alerts',
        'iot_field_sensors',
        'field_scan_gps',
    ],
    'Full Suite': [
        'crop_scan',
        'field_scan',
        'field_scan_manual',
        'livestock',
        'health',
        'production',
        'inventory',
        'finance',
        'weather',
        'ai_chat',
        'team',
        'market',
        'reports',
        'alerts',
        'iot_field_sensors',
        'field_scan_gps',
        'storage_monitoring',
        'co2_detection',
        'pir_detection',
    ],
};

const planCheck = (feature) => {
    return async (req, res, next) => {
        const user = req.user;
        const plan = user.selectedPlan || 'Basic';
        const allowedFeatures = planFeatures[plan] || planFeatures['Basic'];

        if (!allowedFeatures.includes(feature)) {
            return errorResponse(
                res,
                `Your plan (${plan}) does not include this feature. Upgrade to access.`,
                403
            );
        }

        next();
    };
};

module.exports = { planCheck, planFeatures };