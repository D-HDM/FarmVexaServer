const Settings = require('../../models/admin/Settings');
const fastApiTestService = require('../../services/fastApiTestService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

// -------------------------------------------------------------------------
// Existing settings handlers (unchanged behavior + legacy aiUsed sync)
// -------------------------------------------------------------------------

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

    const { gemini, ai, alerts, email, sms, emailToggles, smsToggles, system, fieldScan, storage, virtualDevice } = req.body;

    if (gemini) {
        settings.gemini = { ...settings.gemini.toObject?.() || settings.gemini, ...gemini };
    }
    if (ai) {
        // Merge only the legacy fields via updateSettings. Per-feature
        // assignments are managed exclusively through updateAiProvider()
        // so the test gate cannot be bypassed by PUT /settings.
        const safeAi = { ...ai };
        delete safeAi.chat;
        delete safeAi.crop_scan;
        delete safeAi.field_scan;

        settings.ai = { ...settings.ai.toObject?.() || settings.ai, ...safeAi };

        // Auto-sync legacy aiUsed from chat.provider
        if (settings.ai.chat?.provider) {
            settings.ai.aiUsed = settings.ai.chat.provider;
        }
        settings.markModified('ai');
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
    if (virtualDevice) {
        const currentVirtualDevice = settings.virtualDevice?.toObject?.() || settings.virtualDevice || {};
        settings.virtualDevice = { ...currentVirtualDevice, ...virtualDevice };

        if (virtualDevice.showForPlans) {
            settings.virtualDevice.showForPlans = {
                ...currentVirtualDevice.showForPlans,
                ...virtualDevice.showForPlans,
            };
        }
        if (virtualDevice.readings) {
            settings.virtualDevice.readings = {
                ...currentVirtualDevice.readings,
                ...virtualDevice.readings,
            };
        }
        settings.markModified('virtualDevice');
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

// -------------------------------------------------------------------------
// AI provider routing handlers
// -------------------------------------------------------------------------

const FEATURES = ['chat', 'crop_scan', 'field_scan'];
const PROVIDERS = ['gemini', 'hdm'];
const FRESHNESS_MINUTES = parseInt(process.env.AI_TEST_FRESHNESS_MINUTES || '10', 10);

/**
 * GET /api/admin/settings/ai/config
 *
 * Returns the current provider per feature, plus test freshness metadata.
 * This endpoint is what FastAPI's ai_config_service polls (with X-API-Key).
 */
const getAiConfig = asyncHandler(async (req, res) => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await Settings.create({});
    }

    const ai = settings.ai || {};

    const config = {};
    for (const feature of FEATURES) {
        const f = ai[feature] || {};
        config[feature] = {
            provider: f.provider || 'hdm',
            testedAt: f.testedAt || null,
            testOk: !!f.testOk,
            model: f.model || '',
        };
    }

    return successResponse(res, { providers: config, freshnessMinutes: FRESHNESS_MINUTES });
});

/**
 * PUT /api/admin/settings/ai/config/:feature
 *
 * Body: { provider: 'gemini'|'hdm' }
 *
 * Enforces the test gate: provider must have a fresh, passing test in the
 * last FRESHNESS_MINUTES minutes. Returns 409 otherwise.
 */
const updateAiProvider = asyncHandler(async (req, res) => {
    const { feature } = req.params;
    const { provider } = req.body || {};

    if (!FEATURES.includes(feature)) {
        return errorResponse(res, `feature must be one of: ${FEATURES.join(', ')}`, 400);
    }
    if (!PROVIDERS.includes(provider)) {
        return errorResponse(res, `provider must be one of: ${PROVIDERS.join(', ')}`, 400);
    }

    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings();
    }

    const current = settings.ai?.[feature] || {};

    // Test gate: only allow assignment if the same provider passed a test
    // recently. Admins must run POST /ai/test/... first.
    if (current.provider !== provider || !current.testOk || !current.testedAt) {
        return errorResponse(
            res,
            `${provider} has not passed a test for ${feature} yet. ` +
            `Run POST /api/admin/settings/ai/test/${feature}/${provider} first.`,
            409
        );
    }

    const ageMs = Date.now() - new Date(current.testedAt).getTime();
    if (ageMs > FRESHNESS_MINUTES * 60 * 1000) {
        return errorResponse(
            res,
            `${provider} test for ${feature} is stale (older than ${FRESHNESS_MINUTES} minutes). ` +
            `Re-run the test before assigning.`,
            409
        );
    }

    settings.ai[feature] = {
        provider,
        testedAt: current.testedAt,
        testOk: true,
        model: current.model || '',
    };
    settings.ai.aiUsed = settings.ai.chat?.provider || settings.ai.aiUsed || 'hdm';
    settings.markModified('ai');
    settings.updatedBy = req.user.id;
    await settings.save();

    return successResponse(
        res,
        { feature, provider, testedAt: current.testedAt },
        `${feature} provider set to ${provider}`
    );
});

/**
 * POST /api/admin/settings/ai/test/:feature/:provider
 *
 * Proxies a test to FastAPI and records the result on Settings.ai[feature].
 *
 * Accepts either JSON body or multipart. Multipart is used when testing
 * vision providers with a real image; JSON-only is used for chat.
 */
const testAiProvider = asyncHandler(async (req, res) => {
    const { feature, provider } = req.params;

    if (!FEATURES.includes(feature)) {
        return errorResponse(res, `feature must be one of: ${FEATURES.join(', ')}`, 400);
    }
    if (!PROVIDERS.includes(provider)) {
        return errorResponse(res, `provider must be one of: ${PROVIDERS.join(', ')}`, 400);
    }

    const message = req.body?.message;
    const cropType = req.body?.cropType || 'tomato';
    const imageBuffer = req.file?.buffer;
    const mimeType = req.file?.mimetype || 'image/jpeg';

    const result = await fastApiTestService.test(feature, provider, {
        message,
        imageBuffer,
        mimeType,
        cropType,
    });

    // Persist the test outcome regardless of pass/fail so the UI can show it.
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings();
    }
    if (!settings.ai) settings.ai = {};
    if (!settings.ai[feature]) settings.ai[feature] = {};

    if (result.success) {
        settings.ai[feature].testedAt = new Date();
        settings.ai[feature].testOk = true;
        settings.ai[feature].model = result.model || '';
    } else {
        // Do NOT wipe a previously-passing test on a transient failure;
        // just mark this attempt as failed by leaving testOk as it was,
        // but stamp testedAt so the UI shows recency.
        settings.ai[feature].testedAt = new Date();
        settings.ai[feature].testOk = false;
    }
    settings.markModified('ai');
    await settings.save();

    if (!result.success) {
        return errorResponse(
            res,
            result.error || `Test failed for ${feature}/${provider}`,
            502
        );
    }

    return successResponse(
        res,
        {
            feature,
            provider,
            model: result.model,
            elapsedMs: result.elapsedMs,
        },
        'Provider test completed'
    );
});

module.exports = {
    getSettings,
    updateSettings,
    getAiConfig,
    updateAiProvider,
    testAiProvider,
};