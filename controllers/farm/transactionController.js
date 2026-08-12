const Transaction = require('../../models/farm/Transaction');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getTransactions = asyncHandler(async (req, res) => {
    const { type, category, startDate, endDate, page = 1, limit = 50 } = req.query;
    const query = { farm: req.params.farmId };
    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = new Date(startDate);
        if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    const totals = await Transaction.aggregate([
        { $match: query },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const income = totals.find((t) => t._id === 'income')?.total || 0;
    const expense = totals.find((t) => t._id === 'expense')?.total || 0;

    return successResponse(res, {
        transactions,
        summary: { income, expense, net: income - expense },
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) },
    });
});

const getTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { transaction });
});

const addTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.create({
        ...req.body, farm: req.params.farmId, recordedBy: req.user.id,
    });
    return successResponse(res, { transaction }, 'Transaction recorded', 201);
});

const updateTransaction = asyncHandler(async (req, res) => {
    const transaction = await Transaction.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!transaction) return errorResponse(res, 'Not found', 404);
    return successResponse(res, { transaction }, 'Updated');
});

const deleteTransaction = asyncHandler(async (req, res) => {
    await Transaction.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Deleted');
});

const getSummary = asyncHandler(async (req, res) => {
    const { period } = req.query;
    const now = new Date();
    let startDate;

    if (period === 'week') startDate = new Date(now.getTime() - 7 * 86400000);
    else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);
    else startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const transactions = await Transaction.find({
        farm: req.params.farmId,
        date: { $gte: startDate, $lte: now },
    });

    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const byCategory = {};
    transactions.forEach((t) => {
        const key = t.type === 'income' ? 'income' : t.category;
        byCategory[key] = (byCategory[key] || 0) + t.amount;
    });

    return successResponse(res, {
        summary: { period, startDate, endDate: now, income, expense, net: income - expense, byCategory },
    });
});

module.exports = { getTransactions, getTransaction, addTransaction, updateTransaction, deleteTransaction, getSummary };