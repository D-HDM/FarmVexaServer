const Settings = require('../../models/admin/Settings');
const PaymentMethod = require('../../models/admin/PaymentMethod');
const PaymentModel = require('../../models/admin/PaymentModel');
const Admin = require('../../models/admin/Admin');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getPublicSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    const paymentMethods = await PaymentMethod.find({ enabled: true }).select('-details.consumerKey -details.consumerSecret -details.passkey');
    const paymentModels = await PaymentModel.find({ enabled: true }).sort({ price: 1 });

    return successResponse(res, {
        appName: settings?.system?.appName || 'FarmVexa',
        supportPhone: settings?.system?.supportPhone || '+254700000000',
        supportEmail: settings?.system?.supportEmail || 'support@farmvexa.com',
        whatsappNumber: settings?.system?.whatsappNumber || '',
        showWhatsapp: settings?.system?.showWhatsapp ?? false,
        allowSelfRegistration: settings?.system?.allowSelfRegistration ?? true,
        downloads: settings?.system?.downloads?.filter((d) => d.enabled) || [],
        chatbot: settings?.system?.chatbot || { enabled: false },
        allowExternalCamera: settings?.system?.allowExternalCamera ?? true,
        legal: settings?.system?.legal || { termsOfService: '', privacyPolicy: '', cookiePolicy: '' },
        paymentMethods: paymentMethods.map((m) => ({
            id: m._id,
            name: m.name,
            type: m.type,
            details: {
                paybill: m.details?.paybill,
                accountNumber: m.details?.accountNumber,
                tillNumber: m.details?.tillNumber,
                phoneNumber: m.details?.phoneNumber,
                bankName: m.details?.bankName,
                accountName: m.details?.accountName,
                branch: m.details?.branch,
            },
        })),
        paymentModels: paymentModels.map((p) => ({
            id: p._id,
            name: p.name,
            price: p.price,
            currency: p.currency,
            interval: p.interval,
            features: p.features,
            maxFarms: p.maxFarms,
            maxDevices: p.maxDevices,
            aiRequestsPerDay: p.aiRequestsPerDay,
        })),
    });
});

const checkAdminExists = asyncHandler(async (req, res) => {
    const count = await Admin.countDocuments();
    return successResponse(res, { hasAdmin: count > 0 });
});

const createFirstAdmin = asyncHandler(async (req, res) => {
    const count = await Admin.countDocuments();
    if (count > 0) return errorResponse(res, 'Admin already exists', 400);

    const { name, email, password, phone } = req.body;
    const admin = await Admin.create({ name, email, password, phone, role: 'super_admin' });

    return successResponse(res, {
        admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role },
    }, 'Super admin created', 201);
});

const getChatbotSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    const paymentModels = await PaymentModel.find({ enabled: true }).sort({ price: 1 });

    const chatbot = settings?.system?.chatbot || {};
    if (!chatbot.enabled) {
        return successResponse(res, { enabled: false });
    }

    return successResponse(res, {
        enabled: true,
        name: chatbot.name || 'FarmVexa AI',
        greeting: chatbot.greeting || 'Hello! How can I help you today?',
        position: chatbot.position || 'bottom-right',
        primaryColor: chatbot.primaryColor || '#2d6a4f',
        aiProvider: chatbot.aiProvider || 'gemini',
        systemInfo: {
            appName: settings?.system?.appName || 'FarmVexa',
            tagline: 'See. Sense. Predict. Grow.',
            description: 'AI-Powered Farm Intelligence Platform for crop monitoring, livestock management, financial tracking, and real-time farm insights.',
            supportPhone: settings?.system?.supportPhone || '',
            supportEmail: settings?.system?.supportEmail || '',
            whatsappNumber: settings?.system?.whatsappNumber || '',
            showWhatsapp: settings?.system?.showWhatsapp || false,
        },
        features: [
            'AI Crop Disease Detection',
            'IoT Sensor Monitoring (Soil, Temperature, Humidity)',
            'Livestock & Health Management',
            'Production Tracking (Milk, Eggs, Harvest)',
            'Financial Management & Sales',
            'Stock & Inventory Management',
            'Weather Forecasts & Alerts',
            'Team Management & Task Assignment',
            'Reports & Analytics',
            'AI Chat Assistant (English & Swahili)',
            'Mobile-Friendly Dashboard',
            'SMS & Email Alerts',
        ],
        paymentPlans: paymentModels.map((p) => ({
            name: p.name,
            price: p.price,
            currency: p.currency,
            interval: p.interval,
            features: p.features,
            maxFarms: p.maxFarms,
            maxDevices: p.maxDevices,
            aiRequestsPerDay: p.aiRequestsPerDay,
        })),
        downloads: settings?.system?.downloads?.filter((d) => d.enabled) || [],
        allowSelfRegistration: settings?.system?.allowSelfRegistration ?? true,
    });
});

module.exports = { getPublicSettings, checkAdminExists, createFirstAdmin, getChatbotSettings };