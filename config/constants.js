module.exports = {
    ROLES: {
        SUPER_ADMIN: 'super_admin',
        ADMIN: 'admin',
        FARMER: 'farmer',
    },

    ALERT_TYPES: {
        SOIL_MOISTURE_LOW: 'soil_moisture_low',
        SOIL_MOISTURE_HIGH: 'soil_moisture_high',
        TEMPERATURE_HIGH: 'temperature_high',
        TEMPERATURE_LOW: 'temperature_low',
        DISEASE_RISK: 'disease_risk',
        DISEASE_DETECTED: 'disease_detected',
        DEVICE_OFFLINE: 'device_offline',
        CROP_STRESS: 'crop_stress',
    },

    ALERT_SEVERITY: {
        LOW: 'low',
        MEDIUM: 'medium',
        HIGH: 'high',
        CRITICAL: 'critical',
    },

    DEVICE_STATUS: {
        ONLINE: 'online',
        OFFLINE: 'offline',
        MAINTENANCE: 'maintenance',
    },

    MODEL_STATUS: {
        DRAFT: 'draft',
        TRAINING: 'training',
        TRAINED: 'trained',
        ACTIVE: 'active',
        RETIRED: 'retired',
    },

    STORAGE_TYPES: {
        LOCAL: 'local',
        CLOUDINARY: 'cloudinary',
    },
};