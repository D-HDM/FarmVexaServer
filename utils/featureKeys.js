const FEATURE_LABELS_TO_KEYS = {
    // Basic features
    'AI Crop Scanning': 'crop_scan',
    'Crop Scan': 'crop_scan',
    'Field Scan': 'field_scan_manual',
    'Field Scan (Phone)': 'field_scan_manual',
    'Field Scan with GPS': 'field_scan_gps',
    'GPS Field Scan': 'field_scan_gps',
    'Livestock': 'livestock',
    'Livestock Management': 'livestock',
    'Health': 'health',
    'Health and Vaccination': 'health',
    'Production': 'production',
    'Production Tracking': 'production',
    'Inventory': 'inventory',
    'Stock and Inventory': 'inventory',
    'Finance': 'finance',
    'Finance and Sales': 'finance',
    'Weather': 'weather',
    'Weather Forecasts': 'weather',
    'AI Chat': 'ai_chat',
    'Team': 'team',
    'Team and Tasks': 'team',
    'Market': 'market',
    'Farmers Market': 'market',
    'Reports': 'reports',
    'Reports and Alerts': 'reports',
    'Alerts': 'alerts',
    'IoT Field Sensors': 'iot_field_sensors',
    'IoT Devices': 'iot_field_sensors',
    'Soil Moisture Monitoring': 'iot_field_sensors',
    'Temperature Sensors': 'iot_field_sensors',
    'Light Level Sensing': 'iot_field_sensors',
    'Real-time Dashboard': 'iot_field_sensors',
    'Storage Monitoring': 'storage_monitoring',
    'CO2 Insect Detection': 'co2_detection',
    'PIR Rat Detection': 'pir_detection',
    'Grain Store Sensors': 'storage_monitoring',
    'Pest Alert System': 'pir_detection',
    'All Sensors Included': 'storage_monitoring',
    'Priority Support': 'reports',
    'Everything in Basic': 'crop_scan',
    'Everything in Pro': 'crop_scan',
};

const KNOWN_FEATURE_KEYS = new Set([
    'crop_scan',
    'field_scan',
    'field_scan_manual',
    'field_scan_gps',
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
    'storage_monitoring',
    'co2_detection',
    'pir_detection',
]);

function normalizeFeature(raw) {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (KNOWN_FEATURE_KEYS.has(trimmed)) return trimmed;
    if (FEATURE_LABELS_TO_KEYS[trimmed]) return FEATURE_LABELS_TO_KEYS[trimmed];
    return trimmed;
}

function normalizeFeatures(list) {
    if (!Array.isArray(list)) return [];
    const out = [];
    for (const item of list) {
        const key = normalizeFeature(item);
        if (key && !out.includes(key)) out.push(key);
    }
    return out;
}

module.exports = {
    FEATURE_LABELS_TO_KEYS,
    KNOWN_FEATURE_KEYS,
    normalizeFeature,
    normalizeFeatures,
};