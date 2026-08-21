const VirtualDevice = require('../models/farm/VirtualDevice');
const SensorReading = require('../models/farm/SensorReading');
const Farm = require('../models/farm/Farm');
const User = require('../models/farm/User');
const Device = require('../models/farm/Device');
const Settings = require('../models/admin/Settings');
const weatherService = require('./weatherService');
const logger = require('../utils/logger');

class VirtualDeviceService {

    calculateLightLevel() {
        const now = new Date();
        const hour = now.getHours();

        if (hour >= 19 || hour < 6) {
            return Math.floor(Math.random() * 10); // Night: 0-10
        } else if (hour >= 6 && hour < 9) {
            return 20 + Math.floor(Math.random() * 30); // Morning: 20-50
        } else if (hour >= 9 && hour < 15) {
            return 60 + Math.floor(Math.random() * 30); // Afternoon: 60-90
        } else if (hour >= 15 && hour < 19) {
            return 30 + Math.floor(Math.random() * 30); // Evening: 30-60
        }
        return 50;
    }

    async generateReading(farmId) {
        const settings = await Settings.findOne();
        const virtualSettings = settings?.virtualDevice || {};
        
        if (!virtualSettings.enabled) return null;

        const farm = await Farm.findById(farmId);
        if (!farm) return null;

        // Check plan
        const owner = await User.findById(farm.owner);
        if (!owner) return null;

        const planAllowed = virtualSettings.showForPlans?.[owner.selectedPlan];
        if (!planAllowed) return null;

        // Skip if farm has physical field device
        const hasPhysicalDevice = await Device.exists({ farm: farmId, zone: 'field' });
        if (hasPhysicalDevice) return null;

        // Get or create virtual device
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

        // Generate readings based on toggles
        const reading = {};
        const toggles = virtualSettings.readings || {};
        let weather = null;

        // Fetch weather if any weather-based reading is enabled
        if (toggles.temperature?.enabled || toggles.humidity?.enabled || toggles.soilMoisture?.enabled) {
            weather = await weatherService.getFarmWeather(farmId).catch(() => null);
        }

        if (toggles.temperature?.enabled) {
            reading.temperature = weather?.temperature?.avg || weather?.temperature?.max || 25;
        }

        if (toggles.humidity?.enabled) {
            reading.humidity = weather?.humidity || 60;
        }

        if (toggles.soilMoisture?.enabled) {
            const rainfall = weather?.rainfall || 0;
            reading.soilMoisture = Math.round(Math.min(80, Math.max(15, rainfall * 3 + 20)));
        }

        if (toggles.lightLevel?.enabled) {
            reading.lightLevel = this.calculateLightLevel();
        }

        if (toggles.co2?.enabled) {
            reading.co2 = 400 + Math.floor(Math.random() * 200);
        }

        if (toggles.motion?.enabled) {
            reading.motion = false;
        }

        // Skip if no readings enabled
        if (Object.keys(reading).length === 0) return null;

        // Save reading
        const savedReading = await SensorReading.create({
            device: virtualDevice._id,
            field: null, // Virtual device not tied to a specific field
            ...reading,
            timestamp: new Date(),
        });

        virtualDevice.lastReadingAt = new Date();
        virtualDevice.status = 'online';
        await virtualDevice.save();

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