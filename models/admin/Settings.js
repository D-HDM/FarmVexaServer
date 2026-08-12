const mongoose = require('mongoose');

const emailToggleSchema = new mongoose.Schema({
    farmerRegistrationPending: { type: Boolean, default: true },
    farmerApproved: { type: Boolean, default: true },
    farmerRejected: { type: Boolean, default: true },
    farmerWelcome: { type: Boolean, default: true },
    farmerEmailVerify: { type: Boolean, default: true },
    farmerPasswordReset: { type: Boolean, default: true },
    farmerAlertHigh: { type: Boolean, default: true },
    farmerAlertMedium: { type: Boolean, default: true },
    farmerDiseaseDetected: { type: Boolean, default: true },
    farmerDeviceOffline: { type: Boolean, default: true },
    farmerDailyReport: { type: Boolean, default: true },
    farmerWeeklyReport: { type: Boolean, default: true },
    farmerNewDeviceLogin: { type: Boolean, default: true },
    farmerVaccinationDue: { type: Boolean, default: true },
farmerLivestockAlert: { type: Boolean, default: true },
farmerLowStock: { type: Boolean, default: true },
farmerMaintenanceDue: { type: Boolean, default: true },
farmerWeatherAlert: { type: Boolean, default: true },
farmerTaskOverdue: { type: Boolean, default: true },
teamMemberAdded: { type: Boolean, default: true },
farmerReminderUpcoming: { type: Boolean, default: true },
farmerReminderFinal: { type: Boolean, default: true },
    adminNewFarmer: { type: Boolean, default: true },
    adminSystemCritical: { type: Boolean, default: true },
    adminGeminiEightyPercent: { type: Boolean, default: true },
    adminGeminiExceeded: { type: Boolean, default: true },
    adminPythonOffline: { type: Boolean, default: true },
    adminDeviceOffline24h: { type: Boolean, default: true },
    adminTrainingComplete: { type: Boolean, default: true },
    adminNewAdmin: { type: Boolean, default: true },
    adminWeeklyReport: { type: Boolean, default: true },
});

const smsToggleSchema = new mongoose.Schema({
    farmerApproved: { type: Boolean, default: true },
    farmerWelcome: { type: Boolean, default: true },
    farmerAlertHigh: { type: Boolean, default: true },
    farmerDiseaseDetected: { type: Boolean, default: true },
    farmerDeviceOffline: { type: Boolean, default: true },
    farmerVaccinationDue: { type: Boolean, default: true },
farmerLivestockAlert: { type: Boolean, default: true },
farmerLowStock: { type: Boolean, default: true },
farmerWeatherAlert: { type: Boolean, default: true },
teamMemberAdded: { type: Boolean, default: true },
    adminNewFarmer: { type: Boolean, default: true },
    adminSystemCritical: { type: Boolean, default: true },
    adminGeminiExceeded: { type: Boolean, default: true },
    adminPythonOffline: { type: Boolean, default: true },
});

const emailSettingsSchema = new mongoose.Schema({
    host: { type: String, default: '' },
    port: { type: Number, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, default: '' },
    password: { type: String, default: '' },
    fromEmail: { type: String, default: 'notifications@farmvexa.com' },
    fromName: { type: String, default: 'FarmVexa' },
    enabled: { type: Boolean, default: true },
});

const smsSettingsSchema = new mongoose.Schema({
    provider: { type: String, enum: ['brevo', 'twilio', 'none'], default: 'brevo' },
    apiKey: { type: String, default: '' },
    senderId: { type: String, default: 'FarmVexa' },
    enabled: { type: Boolean, default: false },
});

const settingsSchema = new mongoose.Schema({
    gemini: {
        dailyLimitPerUser: { type: Number, default: 50 },
        dailyLimitTotal: { type: Number, default: 5000 },
    },
    ai: {
        aiUsed: { type: String, enum: ['local', 'gemini', 'hdm'], default: 'gemini' },
        pythonAiUrl: { type: String, default: 'http://localhost:8000' },
        confidenceThreshold: { type: Number, default: 0.75 },
    },
    alerts: {
        soilMoistureLow: { type: Number, default: 20 },
        soilMoistureHigh: { type: Number, default: 80 },
        temperatureHigh: { type: Number, default: 35 },
        temperatureLow: { type: Number, default: 5 },
        humidityHigh: { type: Number, default: 85 },
        diseaseRiskHumidity: { type: Number, default: 75 },
        diseaseRiskTemperature: { type: Number, default: 28 },
        alertFrequency: { type: Number, default: 30 },
    },
    email: {
        type: emailSettingsSchema,
        default: () => ({}),
    },
    sms: {
        type: smsSettingsSchema,
        default: () => ({}),
    },
    emailToggles: {
        type: emailToggleSchema,
        default: () => ({}),
    },
    smsToggles: {
        type: smsToggleSchema,
        default: () => ({}),
    },
system: {
    appName: { type: String, default: 'FarmVexa' },
    supportPhone: { type: String, default: '+254700000000' },
    supportEmail: { type: String, default: 'support@farmvexa.com' },
    whatsappNumber: { type: String, default: '' },
    showWhatsapp: { type: Boolean, default: false },
    dataRetentionDays: { type: Number, default: 90 },
    autoBackup: { type: Boolean, default: false },
    timezone: { type: String, default: 'Africa/Nairobi' },
    language: { type: String, default: 'en' },
    allowSelfRegistration: { type: Boolean, default: true },
    downloads: [{
        name: { type: String, required: true },
        version: { type: String, required: true },
        link: { type: String, required: true },
        description: { type: String },
        platform: { type: String, enum: ['android', 'ios', 'web', 'windows', 'all'], default: 'all' },
        enabled: { type: Boolean, default: true },
    }],
},
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Settings', settingsSchema);