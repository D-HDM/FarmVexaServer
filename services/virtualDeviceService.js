const VirtualDevice = require('../models/farm/VirtualDevice');
const SensorReading = require('../models/farm/SensorReading');
const Farm = require('../models/farm/Farm');
const User = require('../models/farm/User');
const Device = require('../models/farm/Device');
const Settings = require('../models/admin/Settings');
const weatherService = require('./weatherService');
const logger = require('../utils/logger');

class VirtualDeviceService {

    calculateLightLevel(weatherCondition) {
        const now = new Date();
        const hour = now.getHours();

        // Base light by time of day
        let baseLight = 0;

        if (hour >= 19 || hour < 6) {
            baseLight = Math.floor(Math.random() * 10); // Night: 0-10
        } else if (hour >= 6 && hour < 9) {
            baseLight = 20 + Math.floor(Math.random() * 30); // Morning: 20-50
        } else if (hour >= 9 && hour < 15) {
            baseLight = 60 + Math.floor(Math.random() * 30); // Afternoon: 60-90
        } else if (hour >= 15 && hour < 19) {
            baseLight = 30 + Math.floor(Math.random() * 30); // Evening: 30-60
        }

        // Reduce for cloudy/rainy conditions
        const condition = weatherCondition?.toLowerCase() || '';
        if (condition.includes('rain') || condition.includes('storm')) {
            baseLight = Math.floor(baseLight * 0.4); // 60% reduction
        } else if (condition.includes('cloud')) {
            baseLight = Math.floor(baseLight * 0.6); // 40% reduction
        } else if (condition.includes('partly')) {
            baseLight = Math.floor(baseLight * 0.8); // 20% reduction
        }

        return Math.max(0, Math.min(100, baseLight));
    }

    async generateReading(farmId) {
        const settings = await Settings.findOne();
        const virtualSettings = settings?.virtualDevice || {};
        
        if (!virtualSettings.enabled) return null;

        const farm = await Farm.findById(farmId);
        if (!farm) return null;

        const owner = await User.findById(farm.owner);
        if (!owner) return null;

        const planAllowed = virtualSettings.showForPlans?.[owner.selectedPlan];
        if (!planAllowed) return null;

        const hasPhysicalDevice = await Device.exists({ farm: farmId, zone: 'field' });
        if (hasPhysicalDevice) return null;

        let virtualDevice = await VirtualDevice.findOne({ farm: farmId });
        if (!virtualDevice) {
            virtualDevice = await VirtualDevice.create({
                farm: farmId,
                name: virtualSettings.name || 'FarmVexa Virtual',
                zone: 'field',
                sensorType: 'dht',
                status: 'online',
            });
        }

        const reading = {};
        const toggles = virtualSettings.readings || {};
        let freshWeather = null;

        // Fetch FRESH weather from API (not cached)
        if (toggles.temperature?.enabled || toggles.humidity?.enabled || toggles.soilMoisture?.enabled || toggles.lightLevel?.enabled) {
            try {
                freshWeather = await weatherService.fetchForFarm(farmId);
                logger.debug(`Fresh weather fetched for farm ${farmId}`);
            } catch (err) {
                logger.warn(`Fresh weather fetch failed for farm ${farmId}: ${err.message}`);
                freshWeather = null;
            }
        }

        if (toggles.temperature?.enabled) {
            const tempAvg = freshWeather?.temperature?.avg;
            const tempMax = freshWeather?.temperature?.max;
            const tempMin = freshWeather?.temperature?.min;
            reading.temperature = tempAvg || tempMax || 25;

            // Add small variation (±0.5°C) so readings aren't identical
            reading.temperature = Math.round((reading.temperature + (Math.random() - 0.5)) * 10) / 10;
        }

        if (toggles.humidity?.enabled) {
            reading.humidity = Math.round(freshWeather?.humidity || 60);
            
            // Add small variation (±3%)
            reading.humidity = Math.max(10, Math.min(100, reading.humidity + Math.floor((Math.random() - 0.5) * 6)));
        }

        if (toggles.soilMoisture?.enabled) {
            const rainfall = freshWeather?.rainfall || 0;
            const baseSoil = Math.min(80, Math.max(15, rainfall * 3 + 20));
            
            // Add small variation (±3%)
            reading.soilMoisture = Math.max(10, Math.min(85, Math.round(baseSoil + (Math.random() - 0.5) * 6)));
        }

        if (toggles.lightLevel?.enabled) {
            reading.lightLevel = this.calculateLightLevel(freshWeather?.condition);
        }

        if (toggles.co2?.enabled) {
            reading.co2 = 400 + Math.floor(Math.random() * 200);
        }

        if (toggles.motion?.enabled) {
            reading.motion = false;
        }

        if (Object.keys(reading).length === 0) return null;

        const savedReading = await SensorReading.create({
            device: virtualDevice._id,
            field: null,
            ...reading,
            timestamp: new Date(),
        });

        virtualDevice.lastReadingAt = new Date();
        virtualDevice.status = 'online';
        await virtualDevice.save();

        logger.debug(`Virtual reading generated for farm ${farmId}: ${JSON.stringify(reading)}`);

        return savedReading;
    }

    async processAllFarms() {
        const settings = await Settings.findOne();
        const virtualSettings = settings?.virtualDevice || {};
        
        if (!virtualSettings.enabled) {
            logger.debug('Virtual device disabled — skipping');
            return 0;
        }

        const farms = await Farm.find({ status: 'active' });
        let processed = 0;

        for (const farm of farms) {
            try {
                const reading = await this.generateReading(farm._id);
                if (reading) processed++;
            } catch (err) {
                logger.error(`Virtual device failed for farm ${farm._id}: ${err.message}`);
            }
        }

        if (processed > 0) {
            logger.info(`Virtual device: ${processed} farms processed`);
        }

        return processed;
    }

    async getVirtualDevicesForUser(userId) {
        const farms = await Farm.find({ owner: userId }).select('_id').lean();
        const farmIds = farms.map(f => f._id);

        return VirtualDevice.find({ farm: { $in: farmIds } })
            .sort({ createdAt: -1 })
            .lean();
    }
}

module.exports = new VirtualDeviceService();