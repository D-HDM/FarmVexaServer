const cron = require('node-cron');
const SensorReading = require('../models/farm/SensorReading');
const NotificationLog = require('../models/farm/NotificationLog');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    task = cron.schedule('0 0 * * *', async () => {
        logger.info('Running data cleanup...');

        try {
            const settings = await Settings.findOne();
            const retentionDays = settings?.system?.dataRetentionDays || 90;
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

            const deletedReadings = await SensorReading.deleteMany({
                timestamp: { $lt: cutoffDate },
            });
            logger.info(`Deleted ${deletedReadings.deletedCount} old sensor readings`);

            const oldNotifications = await NotificationLog.deleteMany({
                createdAt: { $lt: cutoffDate },
            });
            logger.info(`Deleted ${oldNotifications.deletedCount} old notification logs`);
        } catch (error) {
            logger.error(`Data cleanup scheduler error: ${error.message}`);
        }
    });
};

const stop = () => {
    if (task) task.stop();
};

module.exports = { start, stop };