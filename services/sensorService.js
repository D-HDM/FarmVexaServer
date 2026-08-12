const SensorReading = require('../models/farm/SensorReading');
const Device = require('../models/farm/Device');
const aiService = require('./aiService');
const alertService = require('./alertService');
const logger = require('../utils/logger');

class SensorService {
    async processSensorData(data) {
        const { deviceId, field, temperature, humidity, soilMoisture, lightLevel } = data;

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
            timestamp: new Date(),
        });

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