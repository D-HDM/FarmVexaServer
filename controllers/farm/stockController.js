const Stock = require('../../models/farm/Stock');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getStock = asyncHandler(async (req, res) => {
    const items = await Stock.find({ farm: req.params.farmId }).sort({ product: 1 });
    const lowStock = items.filter((i) => i.minimumStock > 0 && i.quantity <= i.minimumStock);
    const totalValue = items.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0);
    return successResponse(res, { items, lowStock, totalValue });
});

const getStockItem = asyncHandler(async (req, res) => {
    const item = await Stock.findById(req.params.id);
    if (!item) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { item });
});

const stockIn = asyncHandler(async (req, res) => {
    const { product, unit, quantity, pricePerUnit, reason } = req.body;

    let item = await Stock.findOne({ farm: req.params.farmId, product, unit });
    if (item) {
        item.quantity += Number(quantity);
        if (pricePerUnit) item.pricePerUnit = pricePerUnit;
        item.movements.push({ type: 'in', quantity: Number(quantity), date: new Date(), reason, relatedModule: req.body.relatedModule, relatedId: req.body.relatedId });
        await item.save();
    } else {
        item = await Stock.create({
            farm: req.params.farmId, product, unit,
            quantity: Number(quantity),
            pricePerUnit: pricePerUnit || 0,
            movements: [{ type: 'in', quantity: Number(quantity), date: new Date(), reason }],
        });
    }

    return successResponse(res, { item }, 'Stock added');
});

const stockOut = asyncHandler(async (req, res) => {
    const { product, unit, quantity, reason } = req.body;
    
    const item = await Stock.findOne({ farm: req.params.farmId, product, unit });
    if (!item) return errorResponse(res, 'Stock item not found', 404);
    if (item.quantity < Number(quantity)) return errorResponse(res, 'Insufficient stock', 400);

    item.quantity -= Number(quantity);
    item.movements.push({ type: 'out', quantity: Number(quantity), date: new Date(), reason: reason || 'Manual' });
    await item.save();

    return successResponse(res, { item }, 'Stock removed');
});

const updateStock = asyncHandler(async (req, res) => {
    const item = await Stock.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { item }, 'Updated');
});

const deleteStock = asyncHandler(async (req, res) => {
    await Stock.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

const getMovements = asyncHandler(async (req, res) => {
    const item = await Stock.findById(req.params.id);
    if (!item) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { movements: item.movements });
});

module.exports = { getStock, getStockItem, stockIn, stockOut, updateStock, deleteStock, getMovements };