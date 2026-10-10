const cron = require('node-cron');
const Settings = require('../models/admin/Settings');
const backupService = require('../services/backupService');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    task = cron.schedule('0 2 * * *', async () => {
        logger.info('[Backup Scheduler] Checking auto-backup...');

        try {
            const settings = await Settings.findOne();
            if (!settings?.system?.autoBackup) {
                logger.info('[Backup Scheduler] Auto-backup disabled');
                return;
            }

            const backup = await backupService.createBackup(null);
            logger.info(`[Backup Scheduler] Auto-backup created: ${backup.filename}`);

            if (settings.system.sendBackupEmail && settings.system.backupEmail) {
                await emailService.send(settings.system.backupEmail, 'farmerAlertMedium', {
                    user: { name: 'Admin' },
                    message: `FarmVexa auto-backup created: ${backup.filename}. Download: ${backup.cloudinaryUrl || 'N/A'}`,
                    farmName: 'FarmVexa',
                    recommendation: 'Backup is available in the admin panel.',
                });
                logger.info('[Backup Scheduler] Backup email sent');
            }
        } catch (err) {
            logger.error(`[Backup Scheduler] Error: ${err.message}`);
        }
    });
};

const stop = () => { if (task) task.stop(); };

module.exports = { start, stop };