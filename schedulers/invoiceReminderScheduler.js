const cron = require('node-cron');
const Invoice = require('../models/admin/Invoice');
const User = require('../models/farm/User');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    // Every 15 minutes — check for expired invoices and reminders
    task = cron.schedule('*/15 * * * *', async () => {
        logger.debug('Invoice reminder check...');

        try {
            const settings = await Settings.findOne();
            const reminderHours = settings?.invoice?.reminderHoursBeforeDue || 1;
            const autoRejectHours = settings?.invoice?.autoRejectHours || 3;

            const now = new Date();
            const reminderWindow = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);

            // 1. Auto-expire overdue invoices
            const expired = await Invoice.find({
                status: { $in: ['sent', 'draft'] },
                dueDate: { $lt: now },
            });

            for (const inv of expired) {
                inv.status = 'expired';
                await inv.save();

                // If registration invoice expired → auto-reject user
                if (inv.type === 'registration') {
                    const user = await User.findById(inv.user);
                    if (user && user.approvalStatus === 'pending') {
                        user.approvalStatus = 'rejected';
                        user.rejectionReason = `Payment not received within ${autoRejectHours} hours`;
                        user.isActive = false;
                        await user.save();

                        try {
                            await emailService.send(user.email, 'farmerAutoRejected', {
                                user,
                                planName: inv.plan,
                                amount: inv.total,
                                invoiceNumber: inv.invoiceNumber,
                            });
                            if (user.phone) {
                                await smsService.send(user.phone, 'farmerAutoRejected', {
                                    user,
                                    planName: inv.plan,
                                });
                            }
                        } catch (err) {
                            logger.error(`Auto-rejection notification failed: ${err.message}`);
                        }
                    }
                } else if (inv.type === 'renewal') {
                    const user = await User.findById(inv.user);
                    if (user && user.subscriptionStatus === 'pending_renewal') {
                        user.subscriptionStatus = user.isSubscriptionExpired() ? 'expired' : 'active';
                        await user.save();
                    }
                }

                logger.info(`Invoice ${inv.invoiceNumber} expired (${inv.type})`);
            }

            // 2. Send reminder for invoices due soon
            const upcoming = await Invoice.find({
                status: { $in: ['sent', 'draft'] },
                dueDate: { $gte: now, $lte: reminderWindow },
                reminderSentAt: null,
            });

            for (const inv of upcoming) {
                const user = await User.findById(inv.user);
                if (!user) continue;

                try {
                    await emailService.send(user.email, 'farmerInvoiceReminder', {
                        user,
                        invoiceNumber: inv.invoiceNumber,
                        amount: inv.amountDue,
                        currency: inv.currency,
                        dueDate: inv.dueDate,
                        planName: inv.plan,
                    });
                    if (user.phone) {
                        await smsService.send(user.phone, 'farmerInvoiceReminder', {
                            user,
                            invoiceNumber: inv.invoiceNumber,
                            amount: inv.amountDue,
                        });
                    }
                    inv.reminderSentAt = new Date();
                    await inv.save();
                } catch (err) {
                    logger.error(`Invoice reminder failed for ${inv.invoiceNumber}: ${err.message}`);
                }
            }

            if (expired.length > 0 || upcoming.length > 0) {
                logger.info(`Invoice scheduler: ${expired.length} expired, ${upcoming.length} reminders sent`);
            }
        } catch (error) {
            logger.error(`Invoice scheduler error: ${error.message}`);
        }
    });

    logger.info('Invoice reminder scheduler started — every 15 minutes');
};

const stop = () => {
    if (task) task.stop();
};

module.exports = { start, stop };