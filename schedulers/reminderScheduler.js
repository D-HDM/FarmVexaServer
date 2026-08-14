const cron = require('node-cron');
const Farm = require('../models/farm/Farm');
const HealthRecord = require('../models/farm/HealthRecord');
const Inventory = require('../models/farm/Inventory');
const Equipment = require('../models/farm/Equipment');
const Task = require('../models/farm/Task');
const Stock = require('../models/farm/Stock');
const BriefingLog = require('../models/admin/BriefingLog');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

let task = null;

const start = () => {
    task = cron.schedule('0 7 * * *', async () => {
        logger.info('[Reminder] Checking reminders...');

        try {
            const farms = await Farm.find({ status: 'active' }).populate('owner', 'name email phone');
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const dateKey = today.toISOString().split('T')[0] + '-reminder';
            const threeDays = new Date(today); threeDays.setDate(threeDays.getDate() + 3);

            logger.info(`[Reminder] Processing ${farms.length} farms`);

            for (const farm of farms) {
                try {
                    const farmer = farm.owner;
                    if (!farmer?.email) continue;

                    const upcoming = [];
                    const finalReminders = [];

                    const vaccinations = await HealthRecord.find({
                        farm: farm._id, recordType: 'vaccination',
                        nextCheckup: { $ne: null, $lte: threeDays },
                    }).populate('animal', 'tagId name');

                    for (const v of vaccinations) {
                        const due = new Date(v.nextCheckup); due.setHours(0, 0, 0, 0);
                        const days = Math.ceil((due - today) / 86400000);
                        const item = {
                            type: 'vaccination',
                            title: `${v.medication || 'Vaccine'} — ${v.animal?.tagId || v.animal?.name || 'animal'}`,
                            description: v.notes || '',
                            dueDate: v.nextCheckup, days,
                        };
                        if (days === 0) finalReminders.push(item);
                        else if (days <= 3) upcoming.push(item);
                    }

                    const stockItems = await Stock.find({ farm: farm._id });
                    for (const s of stockItems) {
                        if (s.minimumStock > 0 && s.quantity <= s.minimumStock) {
                            const item = {
                                type: 'stock',
                                title: `Low Stock: ${s.product}`,
                                description: `${s.quantity} ${s.unit} remaining`,
                                dueDate: new Date(),
                            };
                            if (s.quantity === 0) finalReminders.push(item);
                            else upcoming.push(item);
                        }
                    }

                    const invItems = await Inventory.find({ farm: farm._id });
                    for (const i of invItems) {
                        if (i.lowStockAlert > 0 && i.quantity <= i.lowStockAlert) {
                            upcoming.push({
                                type: 'inventory',
                                title: `Low: ${i.name}`,
                                description: `${i.quantity} ${i.unit} remaining`,
                                dueDate: new Date(),
                            });
                        }
                    }

                    const equipment = await Equipment.find({
                        farm: farm._id,
                        nextMaintenance: { $ne: null, $lte: threeDays },
                    });
                    for (const e of equipment) {
                        const due = new Date(e.nextMaintenance); due.setHours(0, 0, 0, 0);
                        const days = Math.ceil((due - today) / 86400000);
                        const item = {
                            type: 'equipment',
                            title: `Maintenance: ${e.name}`,
                            dueDate: e.nextMaintenance, days,
                        };
                        if (days === 0) finalReminders.push(item);
                        else if (days <= 3) upcoming.push(item);
                    }

                    const tasks = await Task.find({
                        farm: farm._id,
                        status: { $in: ['pending', 'in_progress'] },
                        dueDate: { $ne: null, $lte: threeDays },
                    });
                    for (const t of tasks) {
                        const due = new Date(t.dueDate); due.setHours(0, 0, 0, 0);
                        const days = Math.ceil((due - today) / 86400000);
                        const item = { type: 'task', title: t.title, dueDate: t.dueDate, days };
                        if (days === 0) finalReminders.push(item);
                        else if (days <= 3) upcoming.push(item);
                    }

                    // Skip if no reminders to send
                    if (upcoming.length === 0 && finalReminders.length === 0) {
                        continue;
                    }

                    // Atomic deduplication — create log FIRST
                    try {
                        await BriefingLog.create({ farm: farm._id, type: 'reminder', dateKey });
                    } catch (dupErr) {
                        logger.info(`[Reminder] Already sent for ${farm.name} today, skipping`);
                        continue;
                    }

                    const settings = await Settings.findOne();

                    if (upcoming.length > 0 && settings?.emailToggles?.farmerReminderUpcoming) {
                        await emailService.send(farmer.email, 'farmerReminderUpcoming', {
                            user: farmer,
                            farmName: farm.name,
                            reminders: upcoming,
                            count: upcoming.length,
                        });
                        logger.info(`[Reminder] Upcoming sent to ${farm.name} (${upcoming.length})`);
                    }

                    if (finalReminders.length > 0) {
                        if (settings?.emailToggles?.farmerReminderFinal) {
                            await emailService.send(farmer.email, 'farmerReminderFinal', {
                                user: farmer,
                                farmName: farm.name,
                                reminders: finalReminders,
                                count: finalReminders.length,
                            });
                        }
                        if (farmer.phone && settings?.smsToggles?.farmerAlertHigh) {
                            await smsService.send(farmer.phone, 'farmerAlertHigh', {
                                user: farmer,
                                message: `${finalReminders.length} items due today on ${farm.name}`,
                                farmName: farm.name,
                            }).catch(() => {});
                        }
                        logger.info(`[Reminder] Final sent to ${farm.name} (${finalReminders.length})`);
                    }
                } catch (err) {
                    logger.error(`[Reminder] Failed for ${farm.name}: ${err.message}`);
                }
            }
        } catch (err) {
            logger.error(`[Reminder] Error: ${err.message}`);
        }
    });
};

const stop = () => { if (task) task.stop(); };

module.exports = { start, stop };