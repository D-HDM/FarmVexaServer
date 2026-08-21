const cron = require('node-cron');
const virtualDeviceService = require('../services/virtualDeviceService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    // Run every 15 minutes — actual interval set per settings
    task = cron.schedule('*/15 * * * *', async () => {
        logger.debug('Virtual device scheduler running...');

        try {
            const settings = await Settings.findOne();
            const virtualSettings = settings?.virtualDevice || {};
            
            if (!virtualSettings.enabled) {
                logger.debug('Virtual device disabled — skipping');
                return;
            }

            const processed = await virtualDeviceService.processAllFarms();
            
            if (processed > 0) {
                logger.info(`Virtual device: ${processed} farms processed`);
            }
        } catch (error) {
            logger.error(`Virtual device scheduler error: ${error.message}`);
        }
    });

    logger.info('Virtual device scheduler started — every 15 minutes');
};

const stop = () => {
    if (task) task.stop();
};

module.exports = { start, stop };