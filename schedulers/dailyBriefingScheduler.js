const cron = require('node-cron');
const Farm = require('../models/farm/Farm');
const Alert = require('../models/farm/Alert');
const ProductionRecord = require('../models/farm/ProductionRecord');
const Animal = require('../models/farm/Animal');
const Device = require('../models/farm/Device');
const SensorReading = require('../models/farm/SensorReading');
const Field = require('../models/farm/Field');
const BriefingLog = require('../models/admin/BriefingLog');
const weatherService = require('../services/weatherService');
const emailService = require('../services/emailService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

let task = null;
let isRunning = false; // ← Prevent overlapping runs

const start = () => {
    task = cron.schedule('0 6 * * *', async () => {
        // Prevent duplicate execution
        if (isRunning) {
            logger.warn('[Daily Briefing] Already running, skipping...');
            return;
        }
        isRunning = true;

        logger.info('[Daily Briefing] Starting...');

        try {
            const farms = await Farm.find({ status: 'active' }).populate('owner', 'name email');
            const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
            const dateKey = todayStart.toISOString().split('T')[0] + '-daily_briefing';

            logger.info(`[Daily Briefing] Processing ${farms.length} farms`);

            for (const farm of farms) {
                try {
                    const farmer = farm.owner;
                    if (!farmer?.email) continue;

                    const settings = await Settings.findOne();
                    if (!settings?.emailToggles?.farmerDailyReport) continue;

                    // Atomic deduplication — use findOneAndUpdate with upsert
                    const existing = await BriefingLog.findOneAndUpdate(
                        { farm: farm._id, type: 'daily_briefing', dateKey },
                        { $setOnInsert: { farm: farm._id, type: 'daily_briefing', dateKey, createdAt: new Date() } },
                        { upsert: true, new: true }
                    );

                    // Check if this was newly created or already existed
                    if (existing.createdAt < todayStart) {
                        logger.info(`[Daily Briefing] Already sent for ${farm.name} today, skipping`);
                        continue;
                    }

                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

                    const todayProd = await ProductionRecord.find({ farm: farm._id, date: { $gte: today } });
                    const yesterdayProd = await ProductionRecord.find({ farm: farm._id, date: { $gte: yesterday, $lt: today } });

                    const todayMilk = todayProd.filter((p) => p.type === 'milk').reduce((s, p) => s + p.quantity, 0);
                    const yesterdayMilk = yesterdayProd.filter((p) => p.type === 'milk').reduce((s, p) => s + p.quantity, 0);
                    const todayEggs = todayProd.filter((p) => p.type === 'eggs').reduce((s, p) => s + p.quantity, 0);
                    const yesterdayEggs = yesterdayProd.filter((p) => p.type === 'eggs').reduce((s, p) => s + p.quantity, 0);

                    const alerts = await Alert.find({ farm: farm._id, severity: { $in: ['high', 'critical'] }, isRead: false }).limit(5);
                    const animalCount = await Animal.countDocuments({ farm: farm._id, status: 'active' });

                    const devices = await Device.find({ farm: farm._id });
                    const onlineDevices = devices.filter((d) => d.status === 'online').length;
                    const deviceList = devices.map((d) => ({
                        name: d.deviceId, status: d.status, lastSeen: d.lastSeen, battery: d.batteryLevel,
                    }));

                    const fieldIds = await Field.find({ farm: farm._id }).distinct('_id');
                    const latestReading = await SensorReading.findOne({ field: { $in: fieldIds } }).sort({ timestamp: -1 });

                    let weather = null;
                    try { 
                        const w = await weatherService.getFarmWeather(farm._id); 
                        weather = w; 
                    } catch (weatherErr) {
                        logger.warn(`[Daily Briefing] Weather failed for ${farm.name}: ${weatherErr.message}`);
                    }

                    await emailService.send(farmer.email, 'farmerDailyReport', {
                        user: farmer,
                        farmName: farm.name,
                        avgTemp: weather?.temperature?.avg?.toFixed(1) || 'N/A',
                        avgHumidity: weather?.humidity || 'N/A',
                        todayMilk, yesterdayMilk,
                        todayEggs, yesterdayEggs,
                        animalCount,
                        alertsCount: alerts.length,
                        healthScore: 75,
                        onlineDevices,
                        totalDevices: devices.length,
                        deviceList,
                        sensorReadings: latestReading ? {
                            temperature: latestReading.temperature,
                            humidity: latestReading.humidity,
                            soilMoisture: latestReading.soilMoisture,
                            lightLevel: latestReading.lightLevel,
                        } : null,
                    });

                    // Mark as sent
                    await BriefingLog.findOneAndUpdate(
                        { farm: farm._id, type: 'daily_briefing', dateKey },
                        { $set: { sentAt: new Date(), status: 'sent' } }
                    );

                    logger.info(`[Daily Briefing] Sent to ${farm.name}`);
                } catch (err) {
                    await BriefingLog.deleteOne({ farm: farm._id, type: 'daily_briefing', dateKey }).catch(() => {});
                    logger.error(`[Daily Briefing] Failed for ${farm.name}: ${err.message}`);
                }
            }
        } catch (err) {
            logger.error(`[Daily Briefing] Error: ${err.message}`);
        } finally {
            isRunning = false;
        }
    });
};

const stop = () => { 
    if (task) task.stop(); 
};

module.exports = { start, stop };