const cron = require('node-cron');
const SensorReading = require('../models/farm/SensorReading');
const Device = require('../models/farm/Device');
const aiService = require('../services/aiService');
const alertService = require('../services/alertService');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    task = cron.schedule('*/5 * * * *', async () => {
        logger.debug('Running sensor check...');

        try {
            const devices = await Device.find({ status: 'online' });

            for (const device of devices) {
                const latestReading = await SensorReading.findOne({ device: device._id })
                    .sort({ timestamp: -1 });

                if (!latestReading) continue;

                const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                if (latestReading.timestamp < tenMinutesAgo) {
                    device.status = 'offline';
                    await device.save();

                    await alertService.createAlert({
                        farm: device.farm,
                        field: device.field,
                        type: 'device_offline',
                        severity: 'high',
                        message: `Device ${device.deviceId} appears offline`,
                    });
                }
            }
        } catch (error) {
            logger.error(`Sensor check scheduler error: ${error.message}`);
        }
    });
};

const stop = () => {
    if (task) task.stop();
};

module.exports = { start, stop };