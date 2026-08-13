const marketService = require('../../services/marketService');
const Settings = require('../../models/admin/Settings');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getMarketStatus = asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    return successResponse(res, {
        enabled: settings?.system?.market?.enabled || false,
    });
});

const getProducts = asyncHandler(async (req, res) => {
    const enabled = await marketService.isMarketEnabled();
    if (!enabled) return successResponse(res, { enabled: false, products: [] });

    const { category, search, county } = req.query;
    const products = await marketService.listActiveProducts({ category, search, county });

    const categories = await require('../../models/farm/MarketProduct').distinct('category', { status: 'active' });

    return successResponse(res, {
        enabled: true,
        products,
        categories,
        total: products.length,
    });
});

const getProduct = asyncHandler(async (req, res) => {
    const enabled = await marketService.isMarketEnabled();
    if (!enabled) return errorResponse(res, 'Market is currently disabled', 403);

    const product = await marketService.getProduct(req.params.id);
    if (!product) return errorResponse(res, 'Product not found', 404);
    if (product.status !== 'active') return errorResponse(res, 'Product no longer available', 404);

    return successResponse(res, { product });
});

const sendInquiry = asyncHandler(async (req, res) => {
    const enabled = await marketService.isMarketEnabled();
    if (!enabled) return errorResponse(res, 'Market is currently disabled', 403);

    const { buyerName, buyerEmail, buyerPhone, message } = req.body;
    if (!buyerName || !message) return errorResponse(res, 'Name and message are required', 400);

    const inquiry = await marketService.createInquiry(req.params.id, {
        buyerName, buyerEmail, buyerPhone, message,
    });

    return successResponse(res, { inquiry }, 'Inquiry sent to farmer', 201);
});

module.exports = { getMarketStatus, getProducts, getProduct, sendInquiry };