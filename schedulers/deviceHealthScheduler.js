const cron = require('node-cron');
const Device = require('../models/farm/Device');
const alertService = require('../services/alertService');
const emailService = require('../services/emailService');
const Admin = require('../models/admin/Admin');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    task = cron.schedule('*/15 * * * *', async () => {
        logger.debug('Checking device health...');

        try {
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

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

            const longOffline = await Device.find({
                status: 'offline',
                lastSeen: { $lt: twentyFourHoursAgo },
            });

            for (const device of longOffline) {
                const admins = await Admin.find({ isActive: true });
                for (const admin of admins) {
                    await emailService.send(admin.email, 'adminDeviceOffline24h', {
                        user: admin,
                        deviceId: device.deviceId,
                        farmName: device.farm,
                        lastSeen: device.lastSeen,
                    });
                }
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