require('dotenv').config();

const env = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT) || 5000,

    // URLs
    apiUrl: process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    adminUrl: process.env.ADMIN_URL || 'http://localhost:3001',
    pythonAiUrl: process.env.PYTHON_AI_URL || 'http://localhost:8000',

    // Database
    mongodbUri: process.env.MONGODB_URI,

    // JWT
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

    // Internal
    internalApiKey: process.env.INTERNAL_API_KEY,

    // Redis
    redisUrl: process.env.REDIS_URL,

    // Cloudinary
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET,

    // Email (HDM Bridge)
    hdmApiKey: process.env.HDM_API_KEY,
    hdmFromEmail: process.env.HDM_FROM_EMAIL || 'notifications@farmvexa.com',
    hdmFromName: process.env.HDM_FROM_NAME || 'FarmVexa',

    // SMS (Brevo)
    brevoApiKey: process.env.BREVO_API_KEY,
    smsFrom: process.env.SMS_FROM || 'FarmVexa',

    // Weather
    weatherApi: process.env.WEATHER_API || 'weatherapi',
    openweatherApiKey: process.env.OPENWEATHER_API_KEY,
    weatherapiKey: process.env.WEATHERAPI_KEY,
    defaultLat: process.env.DEFAULT_LAT || '-1.2833',
    defaultLon: process.env.DEFAULT_LON || '36.8167',

    // M-Pesa
    mpesa: {
        env: process.env.MPESA_ENV || 'production',
        baseUrl: process.env.MPESA_BASE_URL || 'https://api.safaricom.co.ke',
        consumerKey: process.env.MPESA_CONSUMER_KEY,
        consumerSecret: process.env.MPESA_CONSUMER_SECRET,
        shortcode: process.env.MPESA_SHORTCODE,
        tillNumber: process.env.MPESA_TILL_NUMBER,
        passkey: process.env.MPESA_PASSKEY,
        callbackUrl: process.env.MPESA_CALLBACK_URL,
        transactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerBuyGoodsOnline',
    },

    // CORS
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],

    // AI
    aiUsed: process.env.AI_USED || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiApiKeyBackup: process.env.GEMINI_API_KEY_BACKUP,
    geminiFieldscanApiKey: process.env.GEMINI_FIELDSCAN_API_KEY,
    geminiFieldscanApiKeyBackup: process.env.GEMINI_FIELDSCAN_API_KEY_BACKUP,
    hdmAiApiKey: process.env.HDM_AI_API_KEY,
    hdmAiUrl: process.env.HDM_AI_URL,

    // App
    appName: process.env.APP_NAME || 'FarmVexa',
    isProduction: process.env.NODE_ENV === 'production',
    isDevelopment: process.env.NODE_ENV === 'development',
};

module.exports = { env };