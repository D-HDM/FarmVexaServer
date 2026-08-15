const cron = require('node-cron');
const Farm = require('../models/farm/Farm');
const User = require('../models/farm/User');
const SensorReading = require('../models/farm/SensorReading');
const Alert = require('../models/farm/Alert');
const CropImage = require('../models/farm/CropImage');
const emailTemplates = require('../templates/emailTemplates');
const { sendEmail } = require('../config/hdmBridge');
const Settings = require('../models/admin/Settings');
const Admin = require('../models/admin/Admin');
const logger = require('../utils/logger');

let weeklyTask = null;

const start = () => {
    // REMOVED daily report — handled by dailyBriefingScheduler

    weeklyTask = cron.schedule('0 6 * * 1', async () => {
        logger.info('Generating weekly reports...');

        try {
            const farms = await Farm.find({ status: 'active' }).populate('owner');

            for (const farm of farms) {
                if (!farm.owner) continue;

                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const fieldIds = await require('../models/farm/Field').find({ farm: farm._id }).distinct('_id');

                const alerts = await Alert.countDocuments({
                    farm: farm._id,
                    createdAt: { $gte: weekAgo },
                });
                const cropScans = await CropImage.countDocuments({
                    field: { $in: fieldIds },
                    createdAt: { $gte: weekAgo },
                });
                const sensorReadings = await SensorReading.countDocuments({
                    field: { $in: fieldIds },
                    timestamp: { $gte: weekAgo },
                });

                const settings = await Settings.findOne();
                const template = await emailTemplates.farmerWeeklyReport(
                    farm.owner,
                    {
                        farmName: farm.name,
                        avgHealthScore: 75,
                        totalAlerts: alerts,
                        diseasesDetected: 0,
                        cropScans,
                        sensorReadings,
                    },
                    settings
                );

                await sendEmail(farm.owner.email, template.subject, template.html);
            }

            const admins = await Admin.find({ isActive: true });
            const settings = await Settings.findOne();

            for (const admin of admins) {
                const template = await emailTemplates.adminWeeklyReport(
                    admin,
                    {
                        totalFarmers: await User.countDocuments({ role: 'farmer' }),
                        totalFarms: await Farm.countDocuments(),
                        cropScans: await CropImage.countDocuments({ createdAt: { $gte: weekAgo } }),
                        sensorReadings: await SensorReading.countDocuments({ timestamp: { $gte: weekAgo } }),
                        geminiRequests: 0,
                        alertsSent: await Alert.countDocuments({ createdAt: { $gte: weekAgo } }),
                    },
                    settings
                );

                await sendEmail(admin.email, template.subject, template.html);
            }
        } catch (error) {
            logger.error(`Weekly report scheduler error: ${error.message}`);
        }
    });
};

const stop = () => {
    if (weeklyTask) weeklyTask.stop();
};

module.exports = { start, stop };