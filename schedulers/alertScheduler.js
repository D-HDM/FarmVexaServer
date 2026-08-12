const cron = require('node-cron');
const Alert = require('../models/farm/Alert');
const NotificationLog = require('../models/farm/NotificationLog');
const Farm = require('../models/farm/Farm');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    task = cron.schedule('*/2 * * * *', async () => {
        logger.debug('Processing pending alerts...');

        try {
            const pendingAlerts = await Alert.find({
                $or: [{ sentSMS: false }, { sentEmail: false }],
                severity: { $in: ['high', 'critical'] },
            }).limit(10);

            for (const alert of pendingAlerts) {
                const farm = await Farm.findById(alert.farm).populate('owner');
                if (!farm || !farm.owner) {
                    alert.sentSMS = true;
                    alert.sentEmail = true;
                    await alert.save();
                    continue;
                }

                const user = farm.owner;
                const settings = await Settings.findOne();

                if (!alert.sentSMS && user.phone) {
                    try {
                        const msg = await smsService.send(user.phone, 'farmerAlertHigh', {
                            user, message: alert.message, farmName: farm.name,
                        });
                        if (!msg?.skipped) alert.sentSMS = true;
                    } catch (error) {
                        alert.sentSMS = true;
                    }

                    await NotificationLog.create({
                        alert: alert._id, user: user._id, type: 'sms',
                        recipient: user.phone, message: alert.message,
                        status: alert.sentSMS ? 'sent' : 'failed',
                    }).catch(() => {});
                }

                if (!alert.sentEmail) {
                    try {
                        await emailService.send(user.email, 'farmerAlertHigh', {
                            user, message: alert.message, farmName: farm.name,
                            recommendation: alert.recommendation,
                        });
                        alert.sentEmail = true;
                    } catch (error) {
                        alert.sentEmail = true;
                    }

                    await NotificationLog.create({
                        alert: alert._id, user: user._id, type: 'email',
                        recipient: user.email, subject: alert.message,
                        status: alert.sentEmail ? 'sent' : 'failed',
                    }).catch(() => {});
                }

                if (alert.sentSMS && alert.sentEmail) {
                    alert.isModified() && await alert.save();
                } else {
                    await alert.save();
                }
            }
        } catch (error) {
            logger.error(`Alert scheduler error: ${error.message}`);
        }
    });
};

const stop = () => { if (task) task.stop(); };

module.exports = { start, stop };