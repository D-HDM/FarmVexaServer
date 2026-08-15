const Usage = require('../models/admin/Usage');
const Settings = require('../models/admin/Settings');
const emailService = require('./emailService');
const smsService = require('./smsService');
const Admin = require('../models/admin/Admin');
const logger = require('../utils/logger');

class LimitService {
    async checkLimit(userId) {
        const settings = await Settings.findOne();
        const perUserLimit = settings?.gemini?.dailyLimitPerUser || 50;
        const totalLimit = settings?.gemini?.dailyLimitTotal || 5000;

        const today = new Date(); today.setHours(0, 0, 0, 0);

        const userCount = await Usage.countDocuments({ user: userId, requestTimestamp: { $gte: today } });
        if (userCount >= perUserLimit) return { allowed: false, reason: `Daily limit reached. Resets at midnight. (${userCount}/${perUserLimit} used)` };

        const totalCount = await Usage.countDocuments({ requestTimestamp: { $gte: today } });
        if (totalCount >= totalLimit) return { allowed: false, reason: 'System daily limit reached. Resets at midnight.' };

        return { allowed: true, remaining: perUserLimit - userCount, used: userCount, limit: perUserLimit };
    }

    async logUsage(userId, endpoint, success = true, tokensUsed = 0, farmId = null, keyUsed = 'primary', metadata = {}) {
        await Usage.create({ 
            user: userId, 
            farm: farmId, 
            endpoint, 
            tokensUsed, 
            success, 
            keyUsed,
            metadata,
            requestTimestamp: new Date() 
        });
        this.checkThresholds();
    }

    async checkThresholds() {
        const settings = await Settings.findOne();
        const totalLimit = settings?.gemini?.dailyLimitTotal || 5000;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const totalCount = await Usage.countDocuments({ requestTimestamp: { $gte: today } });
        const percentage = (totalCount / totalLimit) * 100;

        if (percentage >= 100) {
            const admins = await Admin.find({ isActive: true });
            for (const admin of admins) {
                smsService.send(admin.phone, 'adminGeminiExceeded', { user: admin, dailyLimit: totalLimit }).catch(() => {});
                emailService.send(admin.email, 'adminGeminiExceeded', { user: admin, requestsToday: totalCount, dailyLimit: totalLimit }).catch(() => {});
            }
        } else if (percentage >= 80) {
            const admins = await Admin.find({ isActive: true });
            for (const admin of admins) {
                emailService.send(admin.email, 'adminGeminiEightyPercent', { user: admin, requestsToday: totalCount, dailyLimit: totalLimit }).catch(() => {});
            }
        }
    }

    async getUserUsage(userId) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayCount = await Usage.countDocuments({ user: userId, requestTimestamp: { $gte: today } });
        const totalCount = await Usage.countDocuments({ user: userId });
        return { today: todayCount, total: totalCount };
    }

    async getFarmUsage(farmId) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayCount = await Usage.countDocuments({ farm: farmId, requestTimestamp: { $gte: today } });
        const totalCount = await Usage.countDocuments({ farm: farmId });
        return { today: todayCount, total: totalCount };
    }

    async getTotalUsage() {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayCount = await Usage.countDocuments({ requestTimestamp: { $gte: today } });
        const totalCount = await Usage.countDocuments();
        
        // Breakdown by endpoint
        const byEndpoint = await Usage.aggregate([
            { $match: { requestTimestamp: { $gte: today } } },
            { $group: { _id: '$endpoint', count: { $sum: 1 } } },
        ]);
        
        // Breakdown by key — treat missing keyUsed as "primary"
        const byKey = await Usage.aggregate([
            { $match: { requestTimestamp: { $gte: today } } },
            { $group: { 
                _id: { $ifNull: ['$keyUsed', 'primary'] }, 
                count: { $sum: 1 } 
            } },
        ]);

        return { 
            today: todayCount, 
            total: totalCount, 
            byEndpoint: byEndpoint.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {}),
            byKey: byKey.reduce((acc, item) => { acc[item._id] = item.count; return acc; }, {}),
        };
    }
}

module.exports = new LimitService();