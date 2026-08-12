const dotenv = require('dotenv');

dotenv.config();

const requiredVars = [
    'MONGODB_URI',
    'JWT_SECRET',
    'PYTHON_AI_URL',
    'INTERNAL_API_KEY',
];

const missingVars = requiredVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

module.exports = {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    apiUrl: process.env.API_URL || 'http://localhost:5000',
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpire: process.env.JWT_EXPIRE || '7d',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE || '30d',
    pythonAiUrl: process.env.PYTHON_AI_URL,
    internalApiKey: process.env.INTERNAL_API_KEY,
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    adminUrl: process.env.ADMIN_URL || 'http://localhost:3001',
    redisEnable: process.env.REDIS_ENABLE || 'false',
    redisUrl: process.env.REDIS_URL,
    storageType: process.env.STORAGE_TYPE || 'local',
};