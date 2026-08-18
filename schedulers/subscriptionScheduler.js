const cron = require('node-cron');
const User = require('../models/farm/User');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');

let task = null;

const checkNow = async () => {
    logger.info('Running subscription check...');

    const now = new Date();
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    try {
        // 1. EXPIRE users immediately (strict — no grace period)
        const expiredUsers = await User.find({
            subscriptionExpiry: { $ne: null, $lt: now },
            subscriptionStatus: { $ne: 'expired' },
            isActive: true,
            approvalStatus: 'approved',
        });

        for (const user of expiredUsers) {
            user.subscriptionStatus = 'expired';
            user.isActive = false;
            await user.save();

            logger.info(`User ${user.email} subscription EXPIRED — blocked immediately`);

            await emailService.send(user.email, 'farmerSubscriptionExpired', {
                user,
                planName: user.selectedPlan,
                amount: user.planPrice,
                expiredAt: user.subscriptionExpiry,
            }).catch((err) => logger.error(`Expiry email failed: ${err.message}`));

            if (user.phone) {
                await smsService.send(user.phone, 'farmerSubscriptionExpired', {
                    user,
                    planName: user.selectedPlan,
                }).catch((err) => logger.error(`Expiry SMS failed: ${err.message}`));
            }
        }

        // 2. Send 3-day reminders
        const expiring3d = await User.find({
            subscriptionExpiry: { $gte: now, $lte: in3Days },
            subscriptionStatus: 'active',
            isActive: true,
        });

        for (const user of expiring3d) {
            const alreadyReminded = user.lastRenewalReminder &&
                new Date(user.lastRenewalReminder) > new Date(Date.now() - 24 * 60 * 60 * 1000);

            if (alreadyReminded) {
                logger.debug(`3-day reminder already sent for ${user.email} — skipping`);
                continue;
            }

            user.lastRenewalReminder = now;
            await user.save();

            logger.info(`3-day reminder sent to ${user.email}`);

            await emailService.send(user.email, 'farmerSubscriptionExpiring3d', {
                user,
                planName: user.selectedPlan,
                amount: user.planPrice,
                expiryDate: user.subscriptionExpiry,
            }).catch((err) => logger.error(`3-day email failed: ${err.message}`));

            if (user.phone) {
                await smsService.send(user.phone, 'farmerSubscriptionExpiring3d', {
                    user,
                    planName: user.selectedPlan,
                    expiryDate: user.subscriptionExpiry,
                }).catch((err) => logger.error(`3-day SMS failed: ${err.message}`));
            }
        }

        // 3. Send 10-day reminders
        const expiring10d = await User.find({
            subscriptionExpiry: { $gte: in3Days, $lte: in10Days },
            subscriptionStatus: 'active',
            isActive: true,
        });

        for (const user of expiring10d) {
            const alreadyReminded = user.lastRenewalReminder &&
                new Date(user.lastRenewalReminder) > new Date(Date.now() - 24 * 60 * 60 * 1000);

            if (alreadyReminded) {
                logger.debug(`10-day reminder already sent for ${user.email} — skipping`);
                continue;
            }

            user.lastRenewalReminder = now;
            await user.save();

            logger.info(`10-day reminder sent to ${user.email}`);

            await emailService.send(user.email, 'farmerSubscriptionExpiring10d', {
                user,
                planName: user.selectedPlan,
                amount: user.planPrice,
                expiryDate: user.subscriptionExpiry,
            }).catch((err) => logger.error(`10-day email failed: ${err.message}`));

            if (user.phone) {
                await smsService.send(user.phone, 'farmerSubscriptionExpiring10d', {
                    user,
                    planName: user.selectedPlan,
                    expiryDate: user.subscriptionExpiry,
                }).catch((err) => logger.error(`10-day SMS failed: ${err.message}`));
            }
        }

        logger.info(`Subscription check complete: ${expiredUsers.length} expired, ${expiring3d.length} expiring in 3d, ${expiring10d.length} expiring in 10d`);
    } catch (error) {
        logger.error(`Subscription check failed: ${error.message}`);
    }
};

const start = () => {
    // Run immediately on server start
    checkNow().catch((err) => logger.error(`Initial subscription check failed: ${err.message}`));

    // Then every hour
    task = cron.schedule('0 * * * *', async () => {
        await checkNow();
    });

    logger.info('Subscription scheduler started — immediate check + hourly');
};

const stop = () => {
    if (task) task.stop();
};

module.exports = { start, stop, checkNow };