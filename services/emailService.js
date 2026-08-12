const { sendEmail } = require('../config/hdmBridge');
const emailTemplates = require('../templates/emailTemplates');
const Settings = require('../models/admin/Settings');
const logger = require('../utils/logger');

class EmailService {
    async send(to, templateName, data) {
        try {
            const settings = await Settings.findOne();
            if (!settings) return { skipped: true, reason: 'No settings found' };

            if (!settings.email?.enabled) {
                return { skipped: true, reason: 'Email disabled' };
            }

            const toggle = settings.emailToggles?.[templateName];
            if (toggle === false) {
                return { skipped: true, reason: `Template "${templateName}" is toggled off` };
            }

            const templateFn = emailTemplates[templateName];
            if (!templateFn) {
                throw new Error(`Email template "${templateName}" not found`);
            }

            const template = await templateFn(data.user || data, data, settings);
            const result = await sendEmail(to, template.subject, template.html);

            logger.info(`Email sent: ${templateName} -> ${to}`);
            return result;
        } catch (error) {
            logger.error(`Email send failed (${templateName}): ${error.message}`);
            throw error;
        }
    }
}

module.exports = new EmailService();