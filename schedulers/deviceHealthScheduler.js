const cron = require('node-cron');
const Device = require('../models/farm/Device');
const Alert = require('../models/farm/Alert');
const alertService = require('../services/alertService');
const emailService = require('../services/emailService');
const Admin = require('../models/admin/Admin');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    task = cron.schedule('*/15 * * * *', async () => {
        logger.debug('Checking device health...');

        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Mark devices offline if not seen in 1 hour
            const recentOffline = await Device.find({
                status: 'online',
                lastSeen: { $lt: oneHourAgo },
            });

            for (const device of recentOffline) {
                device.status = 'offline';
                await device.save();

                await alertService.createAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'device_offline',
                    severity: 'high',
                    message: `Device ${device.deviceId} went offline`,
                });
            }

            // Find devices offline > 24 hours
            const longOffline = await Device.find({
                status: 'offline',
                lastSeen: { $lt: twentyFourHoursAgo },
            });

            // Check email toggle
            const settings = await Settings.findOne();
            const emailEnabled = settings?.emailToggles?.adminDeviceOffline24h !== false;

            if (!emailEnabled) {
                logger.info('adminDeviceOffline24h email toggle is off — skipping all');
                return;
            }

            for (const device of longOffline) {
                // Check if we already sent an email for this device today
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const alreadyNotified = await Alert.findOne({
                    farm: device.farm,
                    type: 'device_offline_24h',
                    message: { $regex: device.deviceId, $options: 'i' },
                    createdAt: { $gte: today },
                });

                if (alreadyNotified) {
                    logger.debug(`Already notified for ${device.deviceId} today — skipping`);
                    continue;
                }

                // Create alert for tracking
                await alertService.createAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'device_offline_24h',
                    severity: 'high',
                    message: `Device ${device.deviceId} offline for 24+ hours`,
                });

                // Send email to admins
                const admins = await Admin.find({ isActive: true });
                for (const admin of admins) {
                    await emailService.send(admin.email, 'adminDeviceOffline24h', {
                        user: admin,
                        deviceId: device.deviceId,
                        farmName: device.farm,
                        lastSeen: device.lastSeen,
                    });
                }

                logger.info(`Sent 24h offline notification for ${device.deviceId}`);
            }
        } catch (error) {
            logger.error(`Device health scheduler error: ${error.message}`);
        }
    });
};

const stop = () => {
    if (task) task.stop();
};

module.exports = { start, stop };