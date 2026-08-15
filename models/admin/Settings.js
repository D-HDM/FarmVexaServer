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
    farmerReminderUpcoming: { type: Boolean, default: true },
    farmerReminderFinal: { type: Boolean, default: true },
    farmerFieldScanResults: { type: Boolean, default: true },
    farmerStorageTempCritical: { type: Boolean, default: true },
    farmerStorageHumidityCritical: { type: Boolean, default: true },
    farmerStorageCo2Critical: { type: Boolean, default: true },
    farmerStorageRatDetected: { type: Boolean, default: true },
    teamMemberAdded: { type: Boolean, default: true },
    adminNewFarmer: { type: Boolean, default: true },
    adminSystemCritical: { type: Boolean, default: true },
    adminGeminiEightyPercent: { type: Boolean, default: true },
    adminGeminiExceeded: { type: Boolean, default: true },
    adminPythonOffline: { type: Boolean, default: true },
    adminDeviceOffline24h: { type: Boolean, default: true },
    adminTrainingComplete: { type: Boolean, default: true },
    adminNewAdmin: { type: Boolean, default: true },
    adminWeeklyReport: { type: Boolean, default: true },
    marketInquiry: { type: Boolean, default: true },
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
    farmerStorageTempCritical: { type: Boolean, default: true },
    farmerStorageHumidityCritical: { type: Boolean, default: true },
    farmerStorageCo2Critical: { type: Boolean, default: true },
    farmerStorageRatDetected: { type: Boolean, default: true },
    teamMemberAdded: { type: Boolean, default: true },
    adminNewFarmer: { type: Boolean, default: true },
    adminSystemCritical: { type: Boolean, default: true },
    adminGeminiExceeded: { type: Boolean, default: true },
    adminPythonOffline: { type: Boolean, default: true },
    marketInquiry: { type: Boolean, default: true },
});

const fieldScanLimitsSchema = new mongoose.Schema({
    daily: { type: Number, default: 10 },
    weekly: { type: Number, default: 50 },
    monthly: { type: Number, default: 200 },
});

const fieldScanSettingsSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    maxPhotosPerScan: { type: Number, default: 100 },
    captureInterval: { type: Number, default: 5 },
    preFilterPercentage: { type: Number, default: 60 },
    farmerLimits: { type: fieldScanLimitsSchema, default: () => ({}) },
    fieldLimits: { type: fieldScanLimitsSchema, default: () => ({}) },
    allowedCropTypes: { type: [String], default: ['tomato', 'vegetable', 'maize', 'potato', 'bean', 'cassava', 'coffee', 'tea', 'wheat', 'rice', 'other'] },
    requireGpsAccuracy: { type: Number, default: 15 },
    preFilterEnabled: { type: Boolean, default: true },
    maxGeminiCallsPerScan: { type: Number, default: 30 },
    minPhotoSize: { type: Number, default: 50 },
    maxPhotoSize: { type: Number, default: 500 },
});

const storageSettingsSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: true },
    
    // Temperature
    tempWarning: { type: Number, default: 30 },      // °C
    tempCritical: { type: Number, default: 35 },      // °C
    
    // Humidity
    humidityWarning: { type: Number, default: 65 },   // %
    humidityCritical: { type: Number, default: 75 },  // %
    
    // CO2 (Insect detection)
    co2Warning: { type: Number, default: 800 },       // ppm
    co2Critical: { type: Number, default: 1200 },     // ppm
    
    // PIR (Rat detection)
    pirEnabled: { type: Boolean, default: true },
    pirNightOnly: { type: Boolean, default: true },
    pirAlertInterval: { type: Number, default: 2 },   // hours
    
    // Cooldown
    cooldownHours: { type: Number, default: 6 },
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

const downloadSchema = new mongoose.Schema({
    name: { type: String, required: true },
    version: { type: String, required: true },
    link: { type: String, required: true },
    description: { type: String },
    platform: { type: String, enum: ['android', 'ios', 'web', 'windows', 'all'], default: 'all' },
    enabled: { type: Boolean, default: true },
});

const chatbotSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    name: { type: String, default: 'FarmVexa AI' },
    greeting: { type: String, default: 'Hello! How can I help you with your farm today?' },
    position: { type: String, enum: ['bottom-right', 'bottom-left'], default: 'bottom-right' },
    primaryColor: { type: String, default: '#2d6a4f' },
    aiProvider: { type: String, enum: ['gemini', 'hdm'], default: 'gemini' },
    geminiApiKey: { type: String, default: '' },
    hdmApiKey: { type: String, default: '' },
    hdmBaseUrl: { type: String, default: 'https://hdmaiserver.pxxl.click/api/v1/projects/general/public-chat' },
});

const legalSchema = new mongoose.Schema({
    termsOfService: { type: String, default: '' },
    privacyPolicy: { type: String, default: '' },
    cookiePolicy: { type: String, default: '' },
});

const weatherTestResultSchema = new mongoose.Schema({
    api: { type: String, enum: ['openweather', 'weatherapi'] },
    status: { type: String, enum: ['success', 'failed'] },
    responseTime: { type: Number },
    data: { type: mongoose.Schema.Types.Mixed },
    error: { type: String },
    testedAt: { type: Date, default: Date.now },
});

const weatherTestSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    location: { type: String, default: 'Nairobi' },
    lastTested: Date,
    results: [weatherTestResultSchema],
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
    email: { type: emailSettingsSchema, default: () => ({}) },
    sms: { type: smsSettingsSchema, default: () => ({}) },
    emailToggles: { type: emailToggleSchema, default: () => ({}) },
    smsToggles: { type: smsToggleSchema, default: () => ({}) },
    fieldScan: { type: fieldScanSettingsSchema, default: () => ({}) },
    storage: { type: storageSettingsSchema, default: () => ({}) },
    system: {
        appName: { type: String, default: 'FarmVexa' },
        supportPhone: { type: String, default: '+254700000000' },
        supportEmail: { type: String, default: 'support@farmvexa.com' },
        whatsappNumber: { type: String, default: '' },
        showWhatsapp: { type: Boolean, default: false },
        dataRetentionDays: { type: Number, default: 90 },
        backupFrequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
        backupEmail: { type: String, default: '' },
        sendBackupEmail: { type: Boolean, default: false },
        timezone: { type: String, default: 'Africa/Nairobi' },
        language: { type: String, default: 'en' },
        allowSelfRegistration: { type: Boolean, default: true },
        downloads: [downloadSchema],
        chatbot: { type: chatbotSchema, default: () => ({}) },
        legal: { type: legalSchema, default: () => ({}) },
        allowExternalCamera: { type: Boolean, default: true },
        externalCameraOutUrl: { type: String, default: 'https://hdmstream.pxxl.click/out' },
        externalCameraInUrl: { type: String, default: 'https://hdmstream.pxxl.click/in' },
        weatherTest: { type: weatherTestSchema, default: () => ({}) },
        market: {
            enabled: { type: Boolean, default: false },
            updatedAt: Date,
        },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);