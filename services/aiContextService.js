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
        } catch (err) {
            logger.error(`AI Context fetch failed for farm ${farmId}: ${err.message}`);
            return null;
        }
    }

    buildSystemPrompt(systemContext, farmContext) {
        let prompt = `You are ${systemContext.appName} AI Assistant. ${systemContext.tagline}. ${systemContext.description}.\n\n`;

        prompt += `SYSTEM INFO:\n`;
        prompt += `App: ${systemContext.appName}\n`;
        prompt += `Support Phone: ${systemContext.supportPhone}\n`;
        prompt += `Support Email: ${systemContext.supportEmail}\n`;
        if (systemContext.whatsappNumber) prompt += `WhatsApp: ${systemContext.whatsappNumber}\n`;

        if (farmContext) {
            prompt += `\nFARM CONTEXT:\n`;
            prompt += `Farm: ${farmContext.farmName}\n`;
            prompt += `Location: ${farmContext.location}\n`;
            prompt += `Size: ${farmContext.size}\n`;

            if (Object.keys(farmContext.animals.byType).length > 0) {
                prompt += `Animals: `;
                prompt += Object.entries(farmContext.animals.byType).map(([type, count]) => `${count} ${type}`).join(', ');
                prompt += `\n`;
            }

            if (farmContext.productionToday.milk > 0 || farmContext.productionToday.eggs > 0) {
                prompt += `Production Today: `;
                const prod = [];
                if (farmContext.productionToday.milk > 0) prod.push(`Milk: ${farmContext.productionToday.milk}L`);
                if (farmContext.productionToday.eggs > 0) prod.push(`Eggs: ${farmContext.productionToday.eggs} pcs`);
                prompt += prod.join(', ') + '\n';
            }

            if (farmContext.stock.length > 0) {
                prompt += `Stock: ${farmContext.stock.join('; ')}\n`;
            }

            if (farmContext.alerts.length > 0) {
                prompt += `Active Alerts: ${farmContext.alerts.join('; ')}\n`;
            }

            prompt += `Devices: ${farmContext.devices.online}/${farmContext.devices.total} online\n`;

            if (farmContext.weather) {
                prompt += `Weather: ${farmContext.weather.condition}, ${farmContext.weather.temperature}°C, Humidity: ${farmContext.weather.humidity}%\n`;
            }
        }

        prompt += `\nYou are a farming assistant. Answer questions about crops, livestock, farm management. Be helpful, concise, and practical. If asked about support, provide the phone number. If you don't know, say so.`;

        return prompt;
    }
}

module.exports = new AIContextService();