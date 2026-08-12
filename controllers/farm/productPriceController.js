const ProductPrice = require('../../models/farm/ProductPrice');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getPrices = asyncHandler(async (req, res) => {
    const { category } = req.query;
    const query = { farm: req.params.farmId };
    if (category) query.category = category;

    const prices = await ProductPrice.find(query).sort({ product: 1, quality: 1 });
    return successResponse(res, { prices });
});

const getPrice = asyncHandler(async (req, res) => {
    const price = await ProductPrice.findById(req.params.id);
    if (!price) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { price });
});

const setPrice = asyncHandler(async (req, res) => {
    const { product, quality, category, unit, pricePerUnit } = req.body;

    let price = await ProductPrice.findOne({
        farm: req.params.farmId, product, quality: quality || 'grade_a',
    });

    if (price) {
        price.pricePerUnit = pricePerUnit;
        price.unit = unit || price.unit;
        price.setBy = req.user.id;
        await price.save();
    } else {
        price = await ProductPrice.create({
            farm: req.params.farmId, product, category, unit,
            quality: quality || 'grade_a', pricePerUnit, setBy: req.user.id,
        });
    }

    return successResponse(res, { price }, 'Price set');
});

const updatePrice = asyncHandler(async (req, res) => {
    const price = await ProductPrice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!price) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { price }, 'Updated');
});

const deletePrice = asyncHandler(async (req, res) => {
    await ProductPrice.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

const getSuggestedProducts = asyncHandler(async (req, res) => {
    const Animal = require('../../models/farm/Animal');
    const Field = require('../../models/farm/Field');

    const animals = await Animal.find({ farm: req.params.farmId });
    const fields = await Field.find({ farm: req.params.farmId });
    const existingPrices = await ProductPrice.find({ farm: req.params.farmId });

    const suggested = [];

    animals.forEach((a) => {
        if (a.type === 'cattle' || a.type === 'goat') {
            if (!existingPrices.find((p) => p.product === 'milk')) {
                suggested.push({ product: 'milk', unit: 'litre', category: 'animal', quality: 'grade_a' });
            }
        }
        if (a.type === 'poultry') {
            if (!existingPrices.find((p) => p.product === 'eggs' && p.unit === 'tray')) {
                suggested.push({ product: 'eggs', unit: 'tray', category: 'animal', quality: 'grade_a' });
            }
            if (!existingPrices.find((p) => p.product === 'eggs' && p.unit === 'piece')) {
                suggested.push({ product: 'eggs', unit: 'piece', category: 'animal', quality: 'grade_a' });
            }
            if (!existingPrices.find((p) => p.product === 'chicken')) {
                suggested.push({ product: 'chicken', unit: 'bird', category: 'animal', quality: 'grade_a' });
            }
        }
        if (a.type === 'sheep') {
            if (!existingPrices.find((p) => p.product === 'mutton')) {
                suggested.push({ product: 'mutton', unit: 'kg', category: 'animal', quality: 'grade_a' });
            }
        }
        if (a.type === 'pig') {
            if (!existingPrices.find((p) => p.product === 'pork')) {
                suggested.push({ product: 'pork', unit: 'kg', category: 'animal', quality: 'grade_a' });
            }
        }
    });

    fields.forEach((f) => {
        if (f.crop) {
            const crop = f.crop.toLowerCase();
            if (!existingPrices.find((p) => p.product === crop)) {
                suggested.push({ product: crop, unit: 'kg', category: 'crop', quality: 'grade_a' });
            }
        }
    });

    return successResponse(res, { suggested, existing: existingPrices });
});

module.exports = { getPrices, getPrice, setPrice, updatePrice, deletePrice,getSuggestedProducts };