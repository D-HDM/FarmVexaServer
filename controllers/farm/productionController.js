const ProductionRecord = require('../../models/farm/ProductionRecord');
const ProductPrice = require('../../models/farm/ProductPrice');
const Transaction = require('../../models/farm/Transaction');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getRecords = asyncHandler(async (req, res) => {
    const { type, animal, field, startDate, endDate } = req.query;
    const query = { farm: req.params.farmId };
    if (type) query.type = type;
    if (animal) query.animal = animal;
    if (field) query.field = field;
    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }

    const records = await ProductionRecord.find(query)
        .populate('animal', 'tagId name type')
        .populate('field', 'name crop')
        .sort({ date: -1 });

    const summary = {
        totalValue: records.reduce((sum, r) => sum + (r.totalValue || 0), 0),
        count: records.length,
        byType: {},
    };
    records.forEach((r) => {
        if (!summary.byType[r.type]) summary.byType[r.type] = { quantity: 0, value: 0 };
        summary.byType[r.type].quantity += r.quantity || 0;
        summary.byType[r.type].value += r.totalValue || 0;
    });

    return successResponse(res, { records, summary });
});

const getRecord = asyncHandler(async (req, res) => {
    const record = await ProductionRecord.findById(req.params.id)
        .populate('animal', 'tagId name type')
        .populate('field', 'name crop');
    if (!record) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { record });
});

const addRecord = asyncHandler(async (req, res) => {
    const { type, quality, quantity, pricePerUnit, date } = req.body;

    const recordDate = date ? new Date(date + 'T12:00:00') : new Date();
    const productName = type === 'milk' ? 'milk' : type === 'eggs' ? 'eggs' : type === 'meat' ? 'chicken' : type;
    const unit = req.body.unit || (type === 'milk' ? 'litre' : type === 'eggs' ? 'piece' : 'kg');

    let totalValue = req.body.totalValue;
    if (!totalValue && quantity) {
        if (pricePerUnit) {
            totalValue = quantity * pricePerUnit;
        } else {
            const price = await ProductPrice.findOne({
                farm: req.params.farmId,
                product: productName,
                unit: unit,
                quality: quality || 'grade_a',
            });
            if (price) totalValue = quantity * price.pricePerUnit;
        }
    }

    const record = await ProductionRecord.create({
        ...req.body, farm: req.params.farmId, totalValue, unit, date: recordDate,
    });

const Stock = require('../../models/farm/Stock');
let stockItem = await Stock.findOne({ farm: req.params.farmId, product: productName, unit });

const ppu = pricePerUnit || (totalValue && quantity ? totalValue / quantity : 0);

if (stockItem) {
    stockItem.quantity += Number(quantity);
    if (ppu > 0) stockItem.pricePerUnit = ppu;
    stockItem.movements.push({
        type: 'in', quantity: Number(quantity), date: recordDate,
        reason: 'Production', relatedModule: 'production', relatedId: record._id,
    });
    await stockItem.save();
} else {
    await Stock.create({
        farm: req.params.farmId, product: productName, unit,
        quantity: Number(quantity),
        pricePerUnit: ppu,
        movements: [{
            type: 'in', quantity: Number(quantity), date: recordDate,
            reason: 'Production', relatedModule: 'production', relatedId: record._id,
        }],
    });
}

    return successResponse(res, { record }, 'Production recorded and stock updated', 201);
});

const updateRecord = asyncHandler(async (req, res) => {
    const record = await ProductionRecord.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!record) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { record }, 'Updated');
});

const deleteRecord = asyncHandler(async (req, res) => {
    const record = await ProductionRecord.findByIdAndDelete(req.params.id);
    if (record?.totalValue) {
        await Transaction.deleteMany({ relatedId: record._id, relatedModule: 'production' });
    }
    return successResponse(res, null, 'Deleted');
});

const getProductionSummary = asyncHandler(async (req, res) => {
    const { period } = req.query;
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    let startDate;

    if (period === 'week') {
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    }

    const records = await ProductionRecord.find({
        farm: req.params.farmId,
        date: { $gte: startDate, $lte: endOfDay },
    });

    const summary = {
        period,
        startDate,
        endDate: now,
        totalValue: records.reduce((s, r) => s + (r.totalValue || 0), 0),
        count: records.length,
        byType: {},
    };

    records.forEach((r) => {
        if (!summary.byType[r.type]) {
            summary.byType[r.type] = { quantity: 0, value: 0 };
        }
        summary.byType[r.type].quantity += r.quantity || 0;
        summary.byType[r.type].value += r.totalValue || 0;
    });

    return successResponse(res, { summary });
});

module.exports = { getRecords, getRecord, addRecord, updateRecord, deleteRecord, getProductionSummary };