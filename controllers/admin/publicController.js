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

module.exports = { getPublicSettings, checkAdminExists, createFirstAdmin };