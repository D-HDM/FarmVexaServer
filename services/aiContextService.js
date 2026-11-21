const Farm = require('../models/farm/Farm');
const Field = require('../models/farm/Field');
const Animal = require('../models/farm/Animal');
const ProductionRecord = require('../models/farm/ProductionRecord');
const Stock = require('../models/farm/Stock');
const Alert = require('../models/farm/Alert');
const Device = require('../models/farm/Device');
const VirtualDevice = require('../models/farm/VirtualDevice');
const SensorReading = require('../models/farm/SensorReading');
const CropImage = require('../models/farm/CropImage');
const FieldScan = require('../models/farm/FieldScan');
const weatherService = require('./weatherService');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

// Disease values that are NOT real findings — don't feed these into the AI context.
const IGNORE_DISEASES = [
    'no plant detected',
    'no crop detected',
    'n/a (non-crop image)',
    'n/a',
    'none',
    'unknown',
    'uncertain',
    'unclear',
];

function isRealDisease(name) {
    if (!name) return false;
    const lower = String(name).trim().toLowerCase();
    return !IGNORE_DISEASES.includes(lower);
}

function formatDate(d) {
    if (!d) return '?';
    try {
        return new Date(d).toISOString().slice(0, 10);
    } catch {
        return '?';
    }
}

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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            fields,
            animals,
            todayProd,
            stock,
            alerts,
            physicalDevices,
            virtualDevices,
            weather,
        ] = await Promise.all([
            Field.find({ farm: farmId, status: 'active' }).lean(),
            Animal.find({ farm: farmId, status: 'active' }).lean(),
            ProductionRecord.find({ farm: farmId, date: { $gte: today } }).lean(),
            Stock.find({ farm: farmId }).lean(),
            // All unread alerts — not just high/critical
            Alert.find({ farm: farmId, isRead: false }).sort({ createdAt: -1 }).limit(15).lean(),
            Device.find({ farm: farmId }).lean(),
            VirtualDevice.find({ farm: farmId }).lean(),
            weatherService.getFarmWeather(farmId).catch(() => null),
        ]);

        // ---- Sensor readings: latest per field ----
        const fieldIds = fields.map((f) => f._id);
        let sensorByField = {};
        if (fieldIds.length > 0) {
            try {
                const readings = await SensorReading.aggregate([
                    { $match: { field: { $in: fieldIds } } },
                    { $sort: { timestamp: -1 } },
                    {
                        $group: {
                            _id: '$field',
                            latest: { $first: '$$ROOT' },
                        },
                    },
                ]);
                for (const r of readings) {
                    sensorByField[String(r._id)] = r.latest;
                }
            } catch (err) {
                logger.warn(`Sensor aggregation failed for farm ${farmId}: ${err.message}`);
            }
        }

        // ---- Recent field scans (last 7, filtered to real findings only) ----
        const rawFieldScans = await FieldScan.find({ farm: farmId })
            .sort({ createdAt: -1 })
            .limit(7)
            .lean();

        const fieldScans = rawFieldScans
            .map((s) => {
                const realDiseases = (s.summary?.diseases || []).filter((d) => isRealDisease(d.name));
                return {
                    date: s.createdAt,
                    analyzedFrames: s.analyzedFrames || 0,
                    healthyCount: s.summary?.healthyCount || 0,
                    realDiseases,
                    hadNoPlantOrCrop: (s.photos || []).length > 0
                        && (s.photos || []).every((p) => {
                            const d = String(p?.analysis?.disease || '').toLowerCase();
                            return d.includes('no plant') || d.includes('no crop') || d.includes('non-crop');
                        }),
                };
            })
            .filter((s) => s.realDiseases.length > 0 || s.healthyCount > 0 || s.hadNoPlantOrCrop);

        // ---- Recent crop scans (last 5, only completed with real disease or healthy) ----
        const rawCropScans = await CropImage.find({ farm: farmId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const cropScans = rawCropScans
            .filter((c) => (c.status || '').toLowerCase() === 'completed')
            .map((c) => ({
                date: c.createdAt,
                cropType: c.cropType,
                disease: c.diseaseDetected,
                confidence: c.confidence,
                severity: c.severity,
                isRealFinding: isRealDisease(c.diseaseDetected)
                    || String(c.diseaseDetected || '').toLowerCase() === 'healthy',
            }))
            .filter((c) => c.isRealFinding)
            .slice(0, 5);

        // ---- Animals ----
        const animalByType = {};
        animals.forEach((a) => {
            if (a.isBatch) animalByType[a.type] = (animalByType[a.type] || 0) + (a.batchCurrent || 0);
            else animalByType[a.type] = (animalByType[a.type] || 0) + 1;
        });

        const milk = todayProd.filter((p) => p.type === 'milk').reduce((s, p) => s + p.quantity, 0);
        const eggs = todayProd.filter((p) => p.type === 'eggs').reduce((s, p) => s + p.quantity, 0);

        const stockSummary = stock.map((s) => `${s.product}: ${s.quantity} ${s.unit}`);

        // Filter alerts to real findings only
        const alertSummary = alerts
            .filter((a) => {
                if (a.type !== 'disease_detected') return true;
                const msg = String(a.message || '');
                const m = msg.match(/^(\S+(?:\s\S+)?)\s+detected/i);
                if (m && IGNORE_DISEASES.includes(m[1].trim().toLowerCase())) return false;
                return true;
            })
            .map((a) => `[${a.severity.toUpperCase()}] ${a.message}`);

        // ---- Devices ----
        const allDevices = [
            ...physicalDevices.map((d) => ({
                name: d.deviceId,
                type: 'physical',
                zone: d.zone || 'field',
                status: d.status,
            })),
            ...virtualDevices.map((v) => ({
                name: v.name || 'FarmVexa Virtual',
                type: 'virtual',
                zone: v.zone || 'field',
                status: v.status,
            })),
        ];

        const onlineDevices = allDevices.filter((d) => d.status === 'online').length;
        const physicalOnline = physicalDevices.filter((d) => d.status === 'online').length;
        const virtualOnline = virtualDevices.filter((v) => v.status === 'online').length;

        // ---- Fields with latest sensor ----
        const fieldsWithSensors = fields.map((f) => {
            const s = sensorByField[String(f._id)];
            return {
                name: f.name,
                crop: f.crop || null,
                size: f.size?.value ? `${f.size.value} ${f.size.unit}` : null,
                status: f.status,
                sensors: s ? {
                    temperature: s.temperature,
                    humidity: s.humidity,
                    soilMoisture: s.soilMoisture,
                    lightLevel: s.lightLevel,
                    timestamp: s.timestamp,
                } : null,
            };
        });

        return {
            farmName: farm.name,
            location: farm.location?.county
                ? `${farm.location.county}${farm.location.subCounty ? ', ' + farm.location.subCounty : ''}`
                : 'Unknown',
            size: farm.size?.value ? `${farm.size.value} ${farm.size.unit}` : 'Unknown',
            fields: fieldsWithSensors,
            animals: {
                total: animals.length,
                byType: animalByType,
            },
            productionToday: { milk, eggs },
            stock: stockSummary,
            alerts: alertSummary,
            devices: {
                total: allDevices.length,
                online: onlineDevices,
                physical: physicalDevices.length,
                physicalOnline,
                virtual: virtualDevices.length,
                virtualOnline,
            },
            fieldScans,
            cropScans,
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
            const farmsList = Array.isArray(farmContext) ? farmContext : [farmContext];
            prompt += `\nFARM CONTEXT (${farmsList.length} farm${farmsList.length > 1 ? 's' : ''}):\n`;

            farmsList.forEach((farm, index) => {
                prompt += `\n--- Farm ${index + 1}: ${farm.farmName} ---\n`;
                prompt += `Location: ${farm.location}\n`;
                prompt += `Size: ${farm.size}\n`;

                // Fields + crops + sensors
                if (farm.fields && farm.fields.length > 0) {
                    prompt += `Fields:\n`;
                    farm.fields.forEach((f) => {
                        let line = `  - ${f.name}`;
                        if (f.crop) line += `: ${f.crop}`;
                        if (f.size) line += ` (${f.size})`;
                        if (f.sensors) {
                            const s = f.sensors;
                            const sensorBits = [];
                            if (s.temperature != null) sensorBits.push(`${s.temperature}°C`);
                            if (s.humidity != null) sensorBits.push(`humidity ${s.humidity}%`);
                            if (s.soilMoisture != null) sensorBits.push(`soil moisture ${s.soilMoisture}%`);
                            if (sensorBits.length > 0) line += ` | latest sensors: ${sensorBits.join(', ')}`;
                        }
                        prompt += line + `\n`;
                    });
                }

                // Animals
                if (Object.keys(farm.animals.byType).length > 0) {
                    prompt += `Animals: `;
                    prompt += Object.entries(farm.animals.byType).map(([type, count]) => `${count} ${type}`).join(', ');
                    prompt += `\n`;
                }

                // Production
                if (farm.productionToday.milk > 0 || farm.productionToday.eggs > 0) {
                    prompt += `Production Today: `;
                    const prod = [];
                    if (farm.productionToday.milk > 0) prod.push(`Milk: ${farm.productionToday.milk}L`);
                    if (farm.productionToday.eggs > 0) prod.push(`Eggs: ${farm.productionToday.eggs} pcs`);
                    prompt += prod.join(', ') + '\n';
                }

                // Stock
                if (farm.stock.length > 0) {
                    prompt += `Stock: ${farm.stock.join('; ')}\n`;
                }

                // Recent field scans — only real findings
                if (farm.fieldScans && farm.fieldScans.length > 0) {
                    prompt += `Recent Field Scans:\n`;
                    farm.fieldScans.forEach((s) => {
                        const date = formatDate(s.date);
                        if (s.realDiseases.length > 0) {
                            const names = s.realDiseases.map((d) => `${d.name}${d.severity ? ` (${d.severity})` : ''}`).join(', ');
                            prompt += `  - ${date}: ${s.analyzedFrames} frames, ${names}\n`;
                        } else if (s.healthyCount > 0) {
                            prompt += `  - ${date}: ${s.analyzedFrames} frames, all healthy\n`;
                        } else if (s.hadNoPlantOrCrop) {
                            prompt += `  - ${date}: ${s.analyzedFrames} frames, no plant/crop detected (camera may need adjustment)\n`;
                        }
                    });
                }

                // Recent crop scans — real findings only
                if (farm.cropScans && farm.cropScans.length > 0) {
                    prompt += `Recent Crop Scans:\n`;
                    farm.cropScans.forEach((c) => {
                        const date = formatDate(c.date);
                        prompt += `  - ${date} (${c.cropType}): ${c.disease}${c.confidence ? `, ${c.confidence}% confidence` : ''}${c.severity ? `, ${c.severity} severity` : ''}\n`;
                    });
                }

                // Alerts
                if (farm.alerts.length > 0) {
                    prompt += `Active Alerts: ${farm.alerts.join('; ')}\n`;
                }

                // Devices summary
                if (farm.devices.total > 0) {
                    prompt += `Devices: ${farm.devices.online}/${farm.devices.total} online (${farm.devices.physical} physical, ${farm.devices.virtual} virtual)\n`;
                }

                // Weather
                if (farm.weather) {
                    const w = farm.weather;
                    const parts = [];
                    if (w.condition) parts.push(w.condition);
                    if (w.temperature) parts.push(`${w.temperature}°C`);
                    if (w.humidity != null) parts.push(`humidity ${w.humidity}%`);
                    if (w.rainfall != null) parts.push(`rainfall ${w.rainfall}mm`);
                    if (parts.length > 0) prompt += `Weather: ${parts.join(', ')}\n`;
                }
            });
        }

        // ---- Anti-hallucination rules ----
        prompt += `\nCRITICAL RULES:\n`;
        prompt += `1. ONLY use data present in FARM CONTEXT above. Never invent farm names, crops, fields, locations, weather, animals, or diseases.\n`;
        prompt += `2. If asked about something not in the context (e.g. a crop that isn't grown, a county not listed), say "I don't have data on that for your farm" and offer to help set it up.\n`;
        prompt += `3. Do NOT reference counties, countries, or regions that aren't listed above. No exceptions.\n`;
        prompt += `4. Do NOT reference crops that aren't planted on these farms. If the user asks about a crop not listed, say so explicitly.\n`;
        prompt += `5. When giving weather advice, ground it in the specific crops and any recent disease findings listed above. Say exactly which field/crop is affected.\n`;
        prompt += `6. Reference specific numbers when available (acres, sensor %, disease confidence %, dates).\n`;
        prompt += `7. If scan data is limited, be honest: "I can only see N recent scans" rather than inventing history.\n`;
        prompt += `8. Only mention the support phone/email if the user explicitly asks for contact details or mentions a problem you can't resolve.\n`;
        prompt += `\nBe concise and practical. Prefer specific, actionable advice over generic best-practice lists.\n`;

        return prompt;
    }
}

module.exports = new AIContextService();