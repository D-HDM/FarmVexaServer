const mongoose = require('mongoose');
const os = require('os');
const { getRedis } = require('../../config/redis');
const aiService = require('../../services/aiService');
const Usage = require('../../models/admin/Usage');
const User = require('../../models/farm/User');
const Farm = require('../../models/farm/Farm');
const Device = require('../../models/farm/Device');
const { successResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getSystemHealth = asyncHandler(async (req, res) => {
    let redisStatus = 'disabled';
    let redisHost = 'N/A';
    const redis = getRedis();
    if (redis) {
        redisStatus = redis.status === 'ready' ? 'up' : 'down';
        redisHost = process.env.REDIS_URL || 'N/A';
    }

    const mongoState = mongoose.connection.readyState;
    const mongoStatus = mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : 'disconnected';

    const aiHealth = await aiService.checkHealth();

    const totalFarmers = await User.countDocuments({ role: 'farmer' });
    const totalFarms = await Farm.countDocuments();
    const onlineDevices = await Device.countDocuments({ status: 'online' });
    const totalDevices = await Device.countDocuments();
    const collections = Object.keys(mongoose.connection.collections).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUsage = await Usage.countDocuments({ requestTimestamp: { $gte: today } });

    return successResponse(res, {
        server: {
            status: 'running',
            node: process.version,
            platform: `${os.platform()} (${os.arch()})`,
            uptime: formatUptime(process.uptime()),
            cpu: `${(os.loadavg()[0] / os.cpus().length * 100).toFixed(2)}% (${os.cpus().length} cores)`,
            memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB / ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
            url: process.env.API_URL || `http://localhost:${process.env.PORT}`,
        },
        database: {
            status: mongoStatus,
            host: mongoose.connection.host || 'N/A',
            database: mongoose.connection.db?.databaseName || 'N/A',
            collections,
        },
        redis: {
            status: redisStatus,
            host: redisHost,
        },
        email: {
            status: process.env.HDM_API_KEY ? 'enabled' : 'disabled',
            provider: 'HDM Bridge',
            from: process.env.HDM_FROM_EMAIL || 'N/A',
            sender: process.env.HDM_FROM_NAME || 'FarmVexa',
        },
        sms: {
            status: process.env.BREVO_API_KEY ? 'enabled' : 'disabled',
            provider: 'Brevo',
            sender: process.env.SMS_FROM || 'FarmVexa',
        },
        storage: {
            status: process.env.CLOUDINARY_CLOUD_NAME ? 'enabled' : 'disabled',
            type: 'cloudinary',
            cloud: process.env.CLOUDINARY_CLOUD_NAME || 'N/A',
        },
        pythonAi: {
            status: aiHealth?.status || 'offline',
            server: aiHealth?.server || {},
            ai: aiHealth?.ai || {},
            mernConnected: aiHealth?.mernConnected || false,  // ← FIXED
            url: process.env.PYTHON_AI_URL || 'N/A',
        },
        cors: {
            origins: process.env.CORS_ORIGINS || 'http://localhost:3000',
        },
        stats: {
            farmers: totalFarmers,
            farms: totalFarms,
            devices: { online: onlineDevices, total: totalDevices },
            todayUsage,
        },
        timestamp: new Date().toISOString(),
    });
});

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}

module.exports = {
    getSystemHealth,
};