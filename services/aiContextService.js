const Farm = require('../models/farm/Farm');
const Animal = require('../models/farm/Animal');
const ProductionRecord = require('../models/farm/ProductionRecord');
const Stock = require('../models/farm/Stock');
const Alert = require('../models/farm/Alert');
const Device = require('../models/farm/Device');
const weatherService = require('./weatherService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

class AIContextService {

    async getSystemContext() {
        const settings = await Settings.findOne();
        return {
            appName: settings?.system?.appName || 'FarmVexa',
            tagline: 'See. Sense. Predict. Grow.',
            description: 'AI-Powered Farm Intelligence Platform',
            supportPhone: settings?.system?.supportPhone || '+254700000000',
            supportEmail: settings?.system?.supportEmail || 'support@farmvexa.com',
            whatsappNumber: settings?.system?.whatsappNumber || '',
        };
    }

    async getFarmContext(farmId) {
        if (!farmId) return null;

        try {
            const farm = await Farm.findById(farmId);
            if (!farm) return null;

            return this.buildSingleFarmContext(farm);
        } catch (err) {
            logger.error(`AI Context fetch failed for farm ${farmId}: ${err.message}`);
            return null;
        }
    }

    async getAllFarmsContext(userId) {
        try {
            const farms = await Farm.find({ owner: userId, status: 'active' });
            if (farms.length === 0) return null;

            const contexts = [];
            for (const farm of farms) {
                const context = await this.buildSingleFarmContext(farm);
                if (context) contexts.push(context);
            }

            return contexts.length > 0 ? contexts : null;
        } catch (err) {
            logger.error(`AI Context fetch failed for user ${userId}: ${err.message}`);
            return null;
        }
    }

    async buildSingleFarmContext(farm) {
        const farmId = farm._id;
        const today = new Date(); today.setHours(0, 0, 0, 0);

        const [animals, todayProd, stock, alerts, devices, weather] = await Promise.all([
            Animal.find({ farm: farmId, status: 'active' }),
            ProductionRecord.find({ farm: farmId, date: { $gte: today } }),
            Stock.find({ farm: farmId }),
            Alert.find({ farm: farmId, isRead: false, severity: { $in: ['high', 'critical'] } }).limit(5),
            Device.find({ farm: farmId }),
            weatherService.getFarmWeather(farmId).catch(() => null),
        ]);

        const animalByType = {};
        animals.forEach((a) => {
            if (a.isBatch) animalByType[a.type] = (animalByType[a.type] || 0) + (a.batchCurrent || 0);
            else animalByType[a.type] = (animalByType[a.type] || 0) + 1;
        });

        const milk = todayProd.filter((p) => p.type === 'milk').reduce((s, p) => s + p.quantity, 0);
        const eggs = todayProd.filter((p) => p.type === 'eggs').reduce((s, p) => s + p.quantity, 0);

        const stockSummary = stock.map((s) => `${s.product}: ${s.quantity} ${s.unit} (KES ${s.pricePerUnit || 0}/${s.unit})`);

        const alertSummary = alerts.map((a) => `[${a.severity.toUpperCase()}] ${a.message}`);

        const onlineDevices = devices.filter((d) => d.status === 'online').length;

        return {
            farmName: farm.name,
            location: farm.location?.county ? `${farm.location.county}, ${farm.location.subCounty || ''}` : 'Unknown',
            size: farm.size?.value ? `${farm.size.value} ${farm.size.unit}` : 'Unknown',
            animals: {
                total: animals.length,
                byType: animalByType,
            },
            productionToday: { milk, eggs },
            stock: stockSummary,
            alerts: alertSummary,
            devices: { total: devices.length, online: onlineDevices },
            weather: weather ? {
                condition: weather.condition,
                temperature: weather.temperature?.avg?.toFixed(1) || weather.temperature?.max,
                humidity: weather.humidity,
                rainfall: weather.rainfall,
            } : null,
        };
    }

    buildSystemPrompt(systemContext, farmContext) {
        let prompt = `You are ${systemContext.appName} AI Assistant. ${systemContext.tagline}. ${systemContext.description}.\n\n`;

        prompt += `SYSTEM INFO:\n`;
        prompt += `App: ${systemContext.appName}\n`;
        prompt += `Support Phone: ${systemContext.supportPhone}\n`;
        prompt += `Support Email: ${systemContext.supportEmail}\n`;
        if (systemContext.whatsappNumber) prompt += `WhatsApp: ${systemContext.whatsappNumber}\n`;

        if (farmContext) {
            // Check if multiple farms
            const farmsList = Array.isArray(farmContext) ? farmContext : [farmContext];

            prompt += `\nFARM CONTEXT (${farmsList.length} farm${farmsList.length > 1 ? 's' : ''}):\n`;

            farmsList.forEach((farm, index) => {
                prompt += `\n--- Farm ${index + 1}: ${farm.farmName} ---\n`;
                prompt += `Location: ${farm.location}\n`;
                prompt += `Size: ${farm.size}\n`;

                if (Object.keys(farm.animals.byType).length > 0) {
                    prompt += `Animals: `;
                    prompt += Object.entries(farm.animals.byType).map(([type, count]) => `${count} ${type}`).join(', ');
                    prompt += `\n`;
                }

                if (farm.productionToday.milk > 0 || farm.productionToday.eggs > 0) {
                    prompt += `Production Today: `;
                    const prod = [];
                    if (farm.productionToday.milk > 0) prod.push(`Milk: ${farm.productionToday.milk}L`);
                    if (farm.productionToday.eggs > 0) prod.push(`Eggs: ${farm.productionToday.eggs} pcs`);
                    prompt += prod.join(', ') + '\n';
                }

                if (farm.stock.length > 0) {
                    prompt += `Stock: ${farm.stock.join('; ')}\n`;
                }

                if (farm.alerts.length > 0) {
                    prompt += `Active Alerts: ${farm.alerts.join('; ')}\n`;
                }

                prompt += `Devices: ${farm.devices.online}/${farm.devices.total} online\n`;

                if (farm.weather) {
                    prompt += `Weather: ${farm.weather.condition}, ${farm.weather.temperature}°C, Humidity: ${farm.weather.humidity}%\n`;
                }
            });
        }

        prompt += `\nYou are a farming assistant. Answer questions about crops, livestock, farm management. Be helpful, concise, and practical. If asked about support, provide the phone number. If you don't know, say so.`;

        return prompt;
    }
}

module.exports = new AIContextService();