const Alert = require('../models/farm/Alert');
const NotificationLog = require('../models/farm/NotificationLog');
const emailTemplates = require('../templates/emailTemplates');
const smsTemplates = require('../templates/smsTemplates');
const { sendEmail } = require('../config/hdmBridge');
const { sendSMS } = require('../config/brevo');
const User = require('../models/farm/User');
const Farm = require('../models/farm/Farm');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

class AlertService {
    async createAlert({ farm, field, type, severity, message, recommendation, data }) {
        const alert = await Alert.create({
            farm,
            field,
            type,
            severity: severity || 'medium',
            message,
            recommendation,
        });

        if (severity === 'high' || severity === 'critical') {
            await this.sendAlertNotifications(alert, data);
        }

        return alert;
    }

    async createStorageAlert({ farm, field, type, severity, message, recommendation, data }) {
        const settings = await Settings.findOne();
        const storage = settings?.storage || {};
        const cooldownHours = storage.cooldownHours || 6;

        // Check cooldown — don't alert more than once per cooldown period
        const lastAlert = await Alert.findOne({
            farm,
            type,
            createdAt: { $gte: new Date(Date.now() - cooldownHours * 3600 * 1000) },
        });

        if (lastAlert) {
            logger.info(`[Storage Alert] Cooldown active for ${type} — skipping`);
            return null;
        }

        const alert = await Alert.create({
            farm,
            field,
            type,
            severity: severity || 'medium',
            message,
            recommendation,
        });

        // Only critical/high alerts get email + SMS
        if (severity === 'high' || severity === 'critical') {
            await this.sendStorageAlertNotifications(alert, data);
        }

        return alert;
    }

    async sendStorageAlertNotifications(alert, data = {}) {
        try {
            const farm = await Farm.findById(alert.farm).populate('owner');
            if (!farm || !farm.owner) return;

            const user = farm.owner;
            const settings = await Settings.findOne();
            const toggles = settings?.emailToggles || {};
            const smsToggles = settings?.smsToggles || {};

            // Determine which toggle to check
            let emailToggleKey = null;
            let smsToggleKey = null;

            switch (alert.type) {
                case 'storage_temp_critical':
                    emailToggleKey = 'farmerStorageTempCritical';
                    smsToggleKey = 'farmerStorageTempCritical';
                    break;
                case 'storage_humidity_critical':
                    emailToggleKey = 'farmerStorageHumidityCritical';
                    smsToggleKey = 'farmerStorageHumidityCritical';
                    break;
                case 'storage_co2_critical':
                    emailToggleKey = 'farmerStorageCo2Critical';
                    smsToggleKey = 'farmerStorageCo2Critical';
                    break;
                case 'storage_rat_detected':
                    emailToggleKey = 'farmerStorageRatDetected';
                    smsToggleKey = 'farmerStorageRatDetected';
                    break;
            }

            // Send SMS
            if (smsToggleKey && smsToggles[smsToggleKey] !== false) {
                const smsTemplate = await smsTemplates.farmerStorageAlert(user, {
                    ...data,
                    message: alert.message,
                    farmName: farm.name,
                    alertType: alert.type,
                }, settings);
                await this.sendSMSNotification(user, alert, smsTemplate);
            }

            // Send Email
            if (emailToggleKey && toggles[emailToggleKey] !== false) {
                const emailTemplate = await emailTemplates.farmerStorageAlert(user, {
                    ...data,
                    message: alert.message,
                    farmName: farm.name,
                    alertType: alert.type,
                    recommendation: alert.recommendation,
                }, settings);
                await this.sendEmailNotification(user, alert, emailTemplate);
            }
        } catch (error) {
            logger.error(`Storage alert notification failed: ${error.message}`);
        }
    }

    async processSensorAlerts(farmId, fieldId, aiData) {
        if (aiData.risk_level === 'LOW') return;

        await this.createAlert({
            farm: farmId,
            field: fieldId,
            type: 'sensor_alert',
            severity: aiData.risk_level === 'HIGH' ? 'high' : 'medium',
            message: aiData.alerts?.join('. ') || 'Sensor alert triggered',
            recommendation: aiData.recommendation,
        });
    }

    async sendAlertNotifications(alert, data = {}) {
        try {
            const farm = await Farm.findById(alert.farm).populate('owner');
            if (!farm || !farm.owner) return;

            const user = farm.owner;
            const settings = await Settings.findOne();

            if (alert.severity === 'high' || alert.severity === 'critical') {
                const smsTemplate = await smsTemplates.farmerAlertHigh(
                    user,
                    { ...data, message: alert.message, farmName: farm.name },
                    settings
                );
                await this.sendSMSNotification(user, alert, smsTemplate);
            }

            const emailTemplate = alert.severity === 'high' || alert.severity === 'critical'
                ? await emailTemplates.farmerAlertHigh(user, { ...data, message: alert.message, farmName: farm.name, fieldName: data.fieldName, recommendation: alert.recommendation }, settings)
                : await emailTemplates.farmerAlertMedium(user, { ...data, message: alert.message, farmName: farm.name, fieldName: data.fieldName, recommendation: alert.recommendation }, settings);

            await this.sendEmailNotification(user, alert, emailTemplate);
        } catch (error) {
            logger.error(`Alert notification failed: ${error.message}`);
        }
    }

    async sendEmailNotification(user, alert, template) {
        try {
            await sendEmail(user.email, template.subject, template.html);
            alert.sentEmail = true;
            await alert.save();

            await NotificationLog.create({
                alert: alert._id,
                user: user._id,
                type: 'email',
                recipient: user.email,
                subject: template.subject,
                message: template.html,
                status: 'sent',
            });
        } catch (error) {
            await NotificationLog.create({
                alert: alert._id,
                user: user._id,
                type: 'email',
                recipient: user.email,
                subject: template?.subject,
                status: 'failed',
                errorMessage: error.message,
            });
        }
    }

    async sendSMSNotification(user, alert, message) {
        try {
            await sendSMS(user.phone, message);
            alert.sentSMS = true;
            await alert.save();

            await NotificationLog.create({
                alert: alert._id,
                user: user._id,
                type: 'sms',
                recipient: user.phone,
                message,
                status: 'sent',
            });
        } catch (error) {
            await NotificationLog.create({
                alert: alert._id,
                user: user._id,
                type: 'sms',
                recipient: user.phone,
                status: 'failed',
                errorMessage: error.message,
            });
        }
    }

    async getFarmAlerts(farmId, limit = 20) {
        return Alert.find({ farm: farmId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }

    async markAsRead(alertId) {
        return Alert.findByIdAndUpdate(alertId, {
            isRead: true,
            readAt: new Date(),
        });
    }
}

module.exports = new AlertService();