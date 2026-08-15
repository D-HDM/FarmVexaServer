const Settings = require('../../models/admin/Settings');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getSettings = asyncHandler(async (req, res) => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await Settings.create({});
    }
    return successResponse(res, { settings });
});

const updateSettings = asyncHandler(async (req, res) => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings();
    }

    const { gemini, ai, alerts, email, sms, emailToggles, smsToggles, system, fieldScan, storage } = req.body;

    if (gemini) {
        settings.gemini = { ...settings.gemini.toObject?.() || settings.gemini, ...gemini };
    }
    if (ai) {
        settings.ai = { ...settings.ai.toObject?.() || settings.ai, ...ai };
    }
    if (alerts) {
        settings.alerts = { ...settings.alerts.toObject?.() || settings.alerts, ...alerts };
    }
    if (email) {
        const currentEmail = settings.email?.toObject?.() || settings.email || {};
        settings.email = { ...currentEmail, ...email };
        settings.markModified('email');
    }
    if (sms) {
        const currentSms = settings.sms?.toObject?.() || settings.sms || {};
        settings.sms = { ...currentSms, ...sms };
        settings.markModified('sms');
    }
    if (emailToggles) {
        const currentEmailToggles = settings.emailToggles?.toObject?.() || settings.emailToggles || {};
        settings.emailToggles = { ...currentEmailToggles, ...emailToggles };
        settings.markModified('emailToggles');
    }
    if (smsToggles) {
        const currentSmsToggles = settings.smsToggles?.toObject?.() || settings.smsToggles || {};
        settings.smsToggles = { ...currentSmsToggles, ...smsToggles };
        settings.markModified('smsToggles');
    }
    if (fieldScan) {
        const currentFieldScan = settings.fieldScan?.toObject?.() || settings.fieldScan || {};
        settings.fieldScan = { ...currentFieldScan, ...fieldScan };
        settings.markModified('fieldScan');
    }
    if (storage) {
        const currentStorage = settings.storage?.toObject?.() || settings.storage || {};
        settings.storage = { ...currentStorage, ...storage };
        settings.markModified('storage');
    }
    if (system) {
        settings.system = { ...settings.system.toObject?.() || settings.system, ...system };
        settings.markModified('system');
    }

    settings.updatedBy = req.user.id;
    await settings.save();

    const updated = await Settings.findOne();
    return successResponse(res, { settings: updated }, 'Settings updated');
});

module.exports = {
    getSettings,
    updateSettings,
};