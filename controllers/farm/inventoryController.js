const Inventory = require('../../models/farm/Inventory');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getItems = asyncHandler(async (req, res) => {
    const { category } = req.query;
    const query = { farm: req.params.farmId };
    if (category) query.category = category;

    const items = await Inventory.find(query).sort({ createdAt: -1 });
    const lowStock = items.filter((i) => i.lowStockAlert && i.quantity <= i.lowStockAlert);

    return successResponse(res, { items, lowStock });
});

const getItem = asyncHandler(async (req, res) => {
    const item = await Inventory.findById(req.params.id);
    if (!item) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { item });
});

const addItem = asyncHandler(async (req, res) => {
    const item = await Inventory.create({ ...req.body, farm: req.params.farmId });
    return successResponse(res, { item }, 'Item added', 201);
});

const updateItem = asyncHandler(async (req, res) => {
    const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { item }, 'Updated');
});

const stockIn = asyncHandler(async (req, res) => {
    const { quantity } = req.body;
    const item = await Inventory.findById(req.params.id);
    if (!item) return errorResponse(res, 'Not found', 404);
    item.quantity += Number(quantity);
    await item.save();
    return successResponse(res, { item }, `Added ${quantity} ${item.unit}. New stock: ${item.quantity}`);
});

const stockOut = asyncHandler(async (req, res) => {
    const { quantity, reason, details } = req.body;
    const item = await Inventory.findById(req.params.id);
    if (!item) return errorResponse(res, 'Not found', 404);
    if (item.quantity < quantity) return errorResponse(res, 'Insufficient stock', 400);
    item.quantity -= Number(quantity);
    await item.save();
    return successResponse(res, { item }, `Removed ${quantity} ${item.unit}. Remaining: ${item.quantity}`);
});

const deleteItem = asyncHandler(async (req, res) => {
    await Inventory.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

module.exports = { getItems, getItem, addItem, updateItem, stockIn, stockOut, deleteItem };