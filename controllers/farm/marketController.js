const MarketProduct = require('../../models/farm/MarketProduct');
const MarketInquiry = require('../../models/farm/MarketInquiry');
const Farm = require('../../models/farm/Farm');
const marketService = require('../../services/marketService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const isMarketEnabled = asyncHandler(async (req, res) => {
    const enabled = await marketService.isMarketEnabled();
    return successResponse(res, { enabled });
});

const getMyProducts = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { farmer: req.user.id };
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const products = await MarketProduct.find(query)
        .populate('farm', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await MarketProduct.countDocuments(query);
    const unreadInquiries = await MarketInquiry.countDocuments({ farmer: req.user.id, isRead: false });

    return successResponse(res, {
        products,
        unreadInquiries,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
});

const getMyProduct = asyncHandler(async (req, res) => {
    const product = await MarketProduct.findOne({ _id: req.params.id, farmer: req.user.id })
        .populate('farm', 'name');
    if (!product) return errorResponse(res, 'Product not found', 404);
    return successResponse(res, { product });
});

const addProduct = asyncHandler(async (req, res) => {
    const enabled = await marketService.isMarketEnabled();
    if (!enabled) return errorResponse(res, 'Market is currently disabled', 403);

    const { name, description, category, price, unit, quantity, contactPhone, contactWhatsapp, contactEmail, exactDirection, farm: farmId, photos, status } = req.body;

    if (!name || !price || !unit || !quantity || !farmId) {
        return errorResponse(res, 'Name, price, unit, quantity, and farm are required', 400);
    }

    const farm = await Farm.findOne({ _id: farmId, owner: req.user.id });
    if (!farm) return errorResponse(res, 'Farm not found', 404);

    const product = await MarketProduct.create({
        farmer: req.user.id,
        farm: farmId,
        name,
        description: description || '',
        category: category || 'other',
        price: Number(price),
        unit,
        quantity: Number(quantity),
        contactPhone: contactPhone || req.user.phone || '',
        contactWhatsapp: contactWhatsapp || contactPhone || '',
        contactEmail: contactEmail || req.user.email || '',
        location: {
            county: farm.location?.county || '',
            subCounty: farm.location?.subCounty || '',
            exactDirection: exactDirection || '',
        },
        photos: photos || [],
        status: status || 'active',
    });

    return successResponse(res, { product }, 'Product added to market', 201);
});

const updateProduct = asyncHandler(async (req, res) => {
    const product = await MarketProduct.findOne({ _id: req.params.id, farmer: req.user.id });
    if (!product) return errorResponse(res, 'Product not found', 404);

    const allowedFields = ['name', 'description', 'category', 'price', 'unit', 'quantity', 'contactPhone', 'contactWhatsapp', 'contactEmail', 'exactDirection', 'photos', 'status'];
    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) product[field] = req.body[field];
    });

    await product.save();
    return successResponse(res, { product }, 'Product updated');
});

const updateProductStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['active', 'sold', 'inactive'].includes(status)) {
        return errorResponse(res, 'Invalid status', 400);
    }

    const product = await MarketProduct.findOne({ _id: req.params.id, farmer: req.user.id });
    if (!product) return errorResponse(res, 'Product not found', 404);

    product.status = status;
    await product.save();

    return successResponse(res, { product }, `Product marked as ${status}`);
});

const deleteProduct = asyncHandler(async (req, res) => {
    const product = await MarketProduct.findOneAndDelete({ _id: req.params.id, farmer: req.user.id });
    if (!product) return errorResponse(res, 'Product not found', 404);
    await MarketInquiry.deleteMany({ product: product._id });
    return successResponse(res, null, 'Product removed from market');
});

const getMyInquiries = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const inquiries = await MarketInquiry.find({ farmer: req.user.id })
        .populate('product', 'name price unit')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await MarketInquiry.countDocuments({ farmer: req.user.id });

    return successResponse(res, {
        inquiries,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
});

const markInquiryRead = asyncHandler(async (req, res) => {
    const inquiry = await marketService.markInquiryRead(req.params.id, req.user.id);
    if (!inquiry) return errorResponse(res, 'Inquiry not found', 404);
    return successResponse(res, { inquiry }, 'Inquiry marked as read');
});

const deleteInquiry = asyncHandler(async (req, res) => {
    const inquiry = await MarketInquiry.findOneAndDelete({ _id: req.params.id, farmer: req.user.id });
    if (!inquiry) return errorResponse(res, 'Inquiry not found', 404);
    return successResponse(res, null, 'Inquiry deleted');
});

const uploadMarketImage = asyncHandler(async (req, res) => {
    if (!req.file) return errorResponse(res, 'No image file provided', 400);

    try {
        const { uploadFile } = require('../../config/cloudinary');
        const result = await uploadFile(req.file.path, {
            folder: 'farmvexa/market',
        });

        const fs = require('fs');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        return successResponse(res, { url: result.url }, 'Image uploaded');
    } catch (err) {
        logger.error(`Market image upload failed: ${err.message}`);
        return errorResponse(res, 'Image upload failed', 500);
    }
});

module.exports = {
    isMarketEnabled, getMyProducts, getMyProduct, addProduct,
    updateProduct, updateProductStatus, deleteProduct,
    getMyInquiries, markInquiryRead, deleteInquiry,
    uploadMarketImage,
};