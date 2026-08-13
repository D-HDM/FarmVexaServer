const Settings = require('../../models/admin/Settings');
const MarketProduct = require('../../models/farm/MarketProduct');
const MarketInquiry = require('../../models/farm/MarketInquiry');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getMarketStatus = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    return successResponse(res, {
        enabled: settings?.system?.market?.enabled || false,
    });
});

const toggleMarket = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    if (!settings) return errorResponse(res, 'Settings not found', 404);

    settings.system.market = settings.system.market || {};
    settings.system.market.enabled = !settings.system.market.enabled;
    settings.system.market.updatedAt = new Date();
    settings.updatedBy = req.user.id;
    await settings.save();

    return successResponse(res, {
        enabled: settings.system.market.enabled,
    }, settings.system.market.enabled ? 'Market enabled' : 'Market disabled');
});

const getFarmers = asyncHandler(async (req, res) => {
    const farmers = await MarketProduct.aggregate([
        { $group: {
            _id: '$farmer',
            products: { $sum: 1 },
            activeProducts: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            totalValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        }},
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'farmerInfo' } },
        { $unwind: '$farmerInfo' },
        { $project: {
            farmerId: '$_id',
            name: '$farmerInfo.name',
            email: '$farmerInfo.email',
            phone: '$farmerInfo.phone',
            products: 1,
            activeProducts: 1,
            totalValue: 1,
        }},
        { $sort: { products: -1 } },
    ]);

    return successResponse(res, { farmers });
});

const getProducts = asyncHandler(async (req, res) => {
    const { status, farmerId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (farmerId) query.farmer = farmerId;

    const products = await MarketProduct.find(query)
        .populate('farmer', 'name email phone')
        .populate('farm', 'name')
        .sort({ createdAt: -1 });

    return successResponse(res, { products, total: products.length });
});

const getProduct = asyncHandler(async (req, res) => {
    const product = await MarketProduct.findById(req.params.id)
        .populate('farmer', 'name email phone')
        .populate('farm', 'name');

    if (!product) return errorResponse(res, 'Product not found', 404);

    const inquiries = await MarketInquiry.find({ product: product._id })
        .sort({ createdAt: -1 });

    return successResponse(res, { product, inquiries });
});

const deleteProduct = asyncHandler(async (req, res) => {
    const product = await MarketProduct.findByIdAndDelete(req.params.id);
    if (!product) return errorResponse(res, 'Product not found', 404);

    await MarketInquiry.deleteMany({ product: product._id });

    return successResponse(res, null, 'Product removed from market');
});

const getInquiries = asyncHandler(async (req, res) => {
    const { farmerId, isRead } = req.query;
    const query = {};
    if (farmerId) query.farmer = farmerId;
    if (isRead !== undefined) query.isRead = isRead === 'true';

    const inquiries = await MarketInquiry.find(query)
        .populate('product', 'name price unit')
        .populate('farmer', 'name email')
        .sort({ createdAt: -1 });

    return successResponse(res, { inquiries, total: inquiries.length });
});

module.exports = {
    getMarketStatus, toggleMarket, getFarmers,
    getProducts, getProduct, deleteProduct, getInquiries,
};