const PaymentModel = require('../models/admin/PaymentModel');
const logger = require('../utils/logger');

const FALLBACK_PLANS = [
    { name: 'Basic Monthly', price: 500, currency: 'KES', interval: 'monthly', features: ['crop_scan', 'field_scan_manual', 'livestock', 'health', 'production', 'inventory', 'finance', 'weather', 'ai_chat', 'team', 'market', 'reports', 'alerts'], maxFarms: 1, maxDevices: 1, aiRequestsPerDay: 50 },
    { name: 'Basic', price: 6000, currency: 'KES', interval: 'one_time', features: ['crop_scan', 'field_scan_manual', 'livestock', 'health', 'production', 'inventory', 'finance', 'weather', 'ai_chat', 'team', 'market', 'reports', 'alerts'], maxFarms: 1, maxDevices: 1, aiRequestsPerDay: 50 },
    { name: 'Pro', price: 10000, currency: 'KES', interval: 'one_time', features: ['crop_scan', 'field_scan', 'field_scan_manual', 'livestock', 'health', 'production', 'inventory', 'finance', 'weather', 'ai_chat', 'team', 'market', 'reports', 'alerts', 'iot_field_sensors', 'field_scan_gps'], maxFarms: 3, maxDevices: 5, aiRequestsPerDay: 200 },
    { name: 'Full Suite', price: 15000, currency: 'KES', interval: 'one_time', features: ['crop_scan', 'field_scan', 'field_scan_manual', 'livestock', 'health', 'production', 'inventory', 'finance', 'weather', 'ai_chat', 'team', 'market', 'reports', 'alerts', 'iot_field_sensors', 'field_scan_gps', 'storage_monitoring', 'co2_detection', 'pir_detection'], maxFarms: 5, maxDevices: 10, aiRequestsPerDay: 500 },
];

class PlanService {
    async getAll({ enabledOnly = true } = {}) {
        const filter = enabledOnly ? { enabled: true } : {};
        let plans = await PaymentModel.find(filter).sort({ price: 1 }).lean();

        if (plans.length === 0) {
            logger.warn('[PlanService] No plans in DB - using fallback');
            plans = FALLBACK_PLANS;
        }
        return plans;
    }

    async getByName(name) {
        if (!name) return null;
        const plan = await PaymentModel.findOne({ name, enabled: true }).lean();
        if (plan) return plan;
        return FALLBACK_PLANS.find((p) => p.name === name) || null;
    }

    async planNames() {
        const plans = await this.getAll();
        return plans.map((p) => p.name);
    }

    async getPlansForUser(user) {
        const plans = await this.getAll();
        const currentPlan = user.selectedPlan || null;
        const currentPlanDoc = currentPlan ? await this.getByName(currentPlan) : null;
        const currentPrice = currentPlanDoc?.price || 0;

        const ordered = plans
            .slice()
            .sort((a, b) => a.price - b.price)
            .map((p, i) => {
                let status = 'available';
                if (p.name === currentPlan) status = 'current';
                else if (p.price <= currentPrice) status = 'purchased';
                else status = 'upgrade_available';

                return {
                    name: p.name,
                    price: p.price,
                    currency: p.currency,
                    interval: p.interval,
                    order: i + 1,
                    features: p.features || [],
                    maxFarms: p.maxFarms,
                    maxDevices: p.maxDevices,
                    aiRequestsPerDay: p.aiRequestsPerDay,
                    status,
                    upgradeCost: status === 'upgrade_available' ? Math.max(0, p.price - currentPrice) : 0,
                };
            });

        return { currentPlan, currentPrice, plans: ordered };
    }
}

module.exports = new PlanService();