const Invoice = require('../../models/admin/Invoice');
const Payment = require('../../models/admin/Payment');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

const getAllInvoices = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status, type } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type) query.type = type;

    const invoices = await Invoice.find(query)
        .populate('user', 'name email phone')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .lean();

    const total = await Invoice.countDocuments(query);

    return successResponse(res, {
        invoices,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

const getInvoiceById = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id)
        .populate('user', 'name email phone')
        .lean();

    if (!invoice) return errorResponse(res, 'Invoice not found', 404);

    const payments = await Payment.find({ invoice: invoice._id }).sort({ createdAt: -1 }).lean();

    return successResponse(res, { invoice, payments });
});

const cancelInvoice = asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);
    if (invoice.status === 'paid') return errorResponse(res, 'Cannot cancel paid invoice', 400);

    invoice.status = 'cancelled';
    await invoice.save();

    return successResponse(res, { invoice }, 'Invoice cancelled');
});

const getInvoiceStats = asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalInvoices, paidToday, unpaidToday, totalRevenue] = await Promise.all([
        Invoice.countDocuments(),
        Invoice.countDocuments({ status: 'paid', paidAt: { $gte: today } }),
        Invoice.countDocuments({ status: 'sent', createdAt: { $gte: today } }),
        Invoice.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: null, sum: { $sum: '$amountPaid' } } },
        ]),
    ]);

    return successResponse(res, {
        totalInvoices,
        paidToday,
        unpaidToday,
        totalRevenue: totalRevenue[0]?.sum || 0,
    });
});

module.exports = {
    getAllInvoices,
    getInvoiceById,
    cancelInvoice,
    getInvoiceStats,
};