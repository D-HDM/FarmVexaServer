const Invoice = require('../../models/admin/Invoice');
const Payment = require('../../models/admin/Payment');
const mpesaService = require('../../services/mpesaService');
const paymentInstructionsService = require('../../services/paymentInstructionsService');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

async function buildFreshInstructions(invoice) {
    try {
        return await paymentInstructionsService.getPaymentInstructions({
            amount: invoice.amountDue ?? invoice.total,
            currency: invoice.currency || 'KES',
            invoiceNumber: invoice.invoiceNumber,
        });
    } catch (err) {
        logger.error(`Fresh instructions failed for ${invoice.invoiceNumber}: ${err.message}`);
        return invoice.paymentInstructions || [];
    }
}

const getPaymentMethods = asyncHandler(async (req, res) => {
    const { amount, currency, invoiceNumber } = req.query;

    if (amount || invoiceNumber) {
        const methods = await paymentInstructionsService.getPaymentInstructions({
            amount: Number(amount) || 0,
            currency: currency || 'KES',
            invoiceNumber: invoiceNumber || '-',
        });
        return successResponse(res, { methods });
    }

    const methods = await paymentInstructionsService.getPublicPaymentMethods();
    return successResponse(res, { methods });
});

const sendStkForInvoice = asyncHandler(async (req, res) => {
    const { invoiceNumber, phone } = req.body;

    if (!invoiceNumber || !phone) {
        return errorResponse(res, 'invoiceNumber and phone required', 400);
    }

    const invoice = await Invoice.findOne({ invoiceNumber });
    if (!invoice) return errorResponse(res, 'Invoice not found', 404);

    if (invoice.status === 'paid') return errorResponse(res, 'Invoice already paid', 400);
    if (invoice.status === 'cancelled') return errorResponse(res, 'Invoice cancelled', 400);
    if (invoice.status === 'expired') return errorResponse(res, 'Invoice expired', 400);
    if (invoice.amountDue <= 0) return errorResponse(res, 'Nothing to pay', 400);

    const stk = await mpesaService.initiateSTKPush({
        phone,
        amount: invoice.amountDue,
        accountReference: invoice.invoiceNumber.substring(0, 12),
        description: `Payment for ${invoice.invoiceNumber}`,
    });

    if (!stk.success) {
        return errorResponse(res, stk.error?.errorMessage || 'STK Push failed', 500);
    }

    invoice.stkLastRequest = {
        checkoutRequestId: stk.checkoutRequestId,
        phone,
        requestedAt: new Date(),
    };
    await invoice.save();

    await Payment.create({
        user: invoice.user,
        invoice: invoice._id,
        purpose: invoice.type,
        method: 'mpesa_stk',
        amount: invoice.amountDue,
        currency: invoice.currency,
        status: 'pending',
        providerRef: stk.checkoutRequestId,
        checkoutRequestId: stk.checkoutRequestId,
        phone,
    });

    return successResponse(res, {
        checkoutRequestId: stk.checkoutRequestId,
        message: stk.customerMessage || 'STK Push sent. Check your phone.',
    }, 'STK Push initiated');
});

const checkStkStatus = asyncHandler(async (req, res) => {
    const { checkoutRequestId } = req.params;
    if (!checkoutRequestId) return errorResponse(res, 'checkoutRequestId required', 400);

    const payment = await Payment.findOne({ checkoutRequestId }).lean();
    if (!payment) return errorResponse(res, 'Payment not found', 404);

    const invoice = payment.invoice
        ? await Invoice.findById(payment.invoice)
            .select('invoiceNumber status amountPaid amountDue currency')
            .lean()
        : null;

    return successResponse(res, {
        status: payment.status,
        invoiceNumber: invoice?.invoiceNumber || null,
        invoiceStatus: invoice?.status || null,
        amountPaid: invoice?.amountPaid || 0,
        amountDue: invoice?.amountDue || 0,
        currency: invoice?.currency || payment.currency,
        receipt: payment.status === 'success' ? payment.mpesaReceipt : null,
    });
});

const getInvoiceByNumber = asyncHandler(async (req, res) => {
    const { invoiceNumber } = req.params;

    const invoice = await Invoice.findOne({ invoiceNumber })
        .select('-__v -stkLastRequest')
        .lean();

    if (!invoice) return errorResponse(res, 'Invoice not found', 404);

    const freshInstructions = await buildFreshInstructions(invoice);

    return successResponse(res, {
        invoice: { ...invoice, paymentInstructions: freshInstructions },
    });
});

module.exports = {
    getPaymentMethods,
    sendStkForInvoice,
    checkStkStatus,
    getInvoiceByNumber,
};