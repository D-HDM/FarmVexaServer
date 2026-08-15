const SensorReading = require('../models/farm/SensorReading');
const Device = require('../models/farm/Device');
const aiService = require('./aiService');
const alertService = require('./alertService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

class SensorService {
    async processSensorData(data) {
        const { deviceId, field, temperature, humidity, soilMoisture, lightLevel, co2, motion } = data;

        const device = await Device.findOne({ deviceId });
        if (!device) {
            throw new Error(`Device ${deviceId} not found`);
        }

        device.lastSeen = new Date();
        device.status = 'online';
        await device.save();

        const reading = await SensorReading.create({
            device: device._id,
            field: field || device.field,
            temperature,
            humidity,
            soilMoisture,
            lightLevel,
            co2,
            motion,
            timestamp: new Date(),
        });

        // === STORAGE MONITORING ===
        if (device.zone === 'storage') {
            await this.processStorageReading(device, reading);
            return reading;
        }

        // === FIELD MONITORING (existing) ===
        const historicalData = await SensorReading.find({
            device: device._id,
        })
            .sort({ timestamp: -1 })
            .limit(10)
            .lean();

        try {
            const aiResult = await aiService.analyzeSensors(
                { temperature, humidity, soilMoisture, lightLevel },
                historicalData.reverse()
            );

            if (aiResult.success && aiResult.data) {
                await alertService.processSensorAlerts(
                    device.farm,
                    device.field,
                    aiResult.data
                );
            }
        } catch (error) {
            logger.error(`AI sensor analysis failed: ${error.message}`);
        }

        return reading;
    }

    async processStorageReading(device, reading) {
        const settings = await Settings.findOne();
        const storage = settings?.storage || {};
        
        if (!storage.enabled) return;

        const { temperature, humidity, co2, motion } = reading;
        const now = new Date();
        const hour = now.getHours();

        // === Temperature Check ===
        if (temperature !== undefined) {
            if (temperature >= (storage.tempCritical || 35)) {
                await alertService.createStorageAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'storage_temp_critical',
                    severity: 'high',
                    message: `Storage temperature critical: ${temperature}°C`,
                    recommendation: 'Ventilate storage immediately. High temperature accelerates insect breeding and mould growth.',
                    data: { temperature, humidity, co2 },
                });
            } else if (temperature >= (storage.tempWarning || 30)) {
                await alertService.createStorageAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'storage_temp_warning',
                    severity: 'medium',
                    message: `Storage temperature high: ${temperature}°C`,
                    recommendation: 'Monitor storage temperature. Consider ventilation.',
                    data: { temperature, humidity, co2 },
                });
            }
        }

        // === Humidity Check ===
        if (humidity !== undefined) {
            if (humidity >= (storage.humidityCritical || 75)) {
                await alertService.createStorageAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'storage_humidity_critical',
                    severity: 'high',
                    message: `Storage humidity critical: ${humidity}%`,
                    recommendation: 'Dehumidify storage immediately. High humidity causes mould and pest activity.',
                    data: { temperature, humidity, co2 },
                });
            } else if (humidity >= (storage.humidityWarning || 65)) {
                await alertService.createStorageAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'storage_humidity_warning',
                    severity: 'medium',
                    message: `Storage humidity high: ${humidity}%`,
                    recommendation: 'Monitor storage humidity. Consider dehumidification.',
                    data: { temperature, humidity, co2 },
                });
            }
        }

        // === CO2 Check (Insect detection) ===
        if (co2 !== undefined) {
            if (co2 >= (storage.co2Critical || 1200)) {
                await alertService.createStorageAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'storage_co2_critical',
                    severity: 'high',
                    message: `Storage CO2 critical: ${co2}ppm — active insect infestation suspected`,
                    recommendation: 'Inspect grain immediately. Consider fumigation.',
                    data: { temperature, humidity, co2 },
                });
            } else if (co2 >= (storage.co2Warning || 800)) {
                await alertService.createStorageAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'storage_co2_warning',
                    severity: 'medium',
                    message: `Storage CO2 elevated: ${co2}ppm — possible insect activity`,
                    recommendation: 'Monitor CO2 levels. Inspect grain for pests.',
                    data: { temperature, humidity, co2 },
                });
            }
        }

        // === PIR Motion Check (Rat detection) ===
        if (motion === true && storage.pirEnabled !== false) {
            const isNight = hour >= 20 || hour < 6;
            
            if (storage.pirNightOnly === true && !isNight) {
                // Skip — night only mode and it's daytime
            } else {
                await alertService.createStorageAlert({
                    farm: device.farm,
                    field: device.field,
                    type: 'storage_rat_detected',
                    severity: 'high',
                    message: `Motion detected in storage at ${now.toLocaleTimeString()}`,
                    recommendation: 'Check storage for rats. Inspect entry points and set traps.',
                    data: { motion: true, hour },
                });
            }
        }
    }

    async getFieldReadings(fieldId, limit = 50) {
        return SensorReading.find({ field: fieldId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    }

    async getDeviceReadings(deviceId, limit = 50) {
        return SensorReading.find({ device: deviceId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
    }
}

module.exports = new SensorService();