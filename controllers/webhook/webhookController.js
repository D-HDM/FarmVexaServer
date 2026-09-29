const Invoice = require('../../models/admin/Invoice');
const Payment = require('../../models/admin/Payment');
const User = require('../../models/farm/User');
const mpesaService = require('../../services/mpesaService');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const { successResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

async function handleInvoicePayment(payment, parsed) {
    const invoice = payment.invoice
        ? await Invoice.findById(payment.invoice)
        : await Invoice.findOne({ 'stkLastRequest.checkoutRequestId': parsed.checkoutRequestId });

    if (!invoice) {
        logger.warn(`Invoice not found for checkoutRequestId ${parsed.checkoutRequestId}`);
        return;
    }

    if (!parsed.success) {
        invoice.status = 'failed';
        invoice.paymentMethod = 'mpesa_stk';
        invoice.paymentRef = parsed.resultDesc || 'Failed';
        await invoice.save();
        logger.warn(`Invoice ${invoice.invoiceNumber} payment failed: ${parsed.resultDesc}`);
        return;
    }

    // Mark paid
    invoice.status = 'paid';
    invoice.amountPaid = parsed.amount || invoice.amountDue;
    invoice.amountDue = 0;
    invoice.paidAt = new Date();
    invoice.paymentMethod = 'mpesa_stk';
    invoice.paymentRef = parsed.mpesaReceiptNumber || null;
    await invoice.save();

    logger.info(`Invoice ${invoice.invoiceNumber} paid. Receipt: ${parsed.mpesaReceiptNumber}`);

    // Notify user
    try {
        const user = await User.findById(invoice.user);
        if (user) {
            await emailService.send(user.email, 'farmerPaymentReceived', {
                user,
                name: user.name,
                invoiceNumber: invoice.invoiceNumber,
                amount: parsed.amount || invoice.amountPaid,
                currency: invoice.currency,
                paidAt: new Date(),
                paymentMethod: 'mpesa_stk',
                paymentReference: parsed.mpesaReceiptNumber,
            }).catch(() => {});

            if (user.phone) {
                await smsService.send(user.phone, 'farmerPaymentReceived', {
                    user,
                    invoiceNumber: invoice.invoiceNumber,
                    amount: parsed.amount,
                }).catch(() => {});
            }
        }
    } catch (notifyErr) {
        logger.error(`Payment notification failed: ${notifyErr.message}`);
    }

    // Notify admins
    try {
        const Admin = require('../../models/admin/Admin');
        const admins = await Admin.find({ isActive: true });
        const user = await User.findById(invoice.user);

        for (const admin of admins) {
            await emailService.send(admin.email, 'adminPaymentReceived', {
                user: { name: admin.name, email: admin.email },
                farmer: { name: user?.name, email: user?.email, phone: user?.phone },
                invoiceNumber: invoice.invoiceNumber,
                planName: invoice.plan,
                amount: invoice.amountPaid,
                paymentMethod: 'mpesa_stk',
                reference: parsed.mpesaReceiptNumber,
            }).catch(() => {});
        }
    } catch (adminNotifyErr) {
        logger.error(`Admin payment notification failed: ${adminNotifyErr.message}`);
    }
}

const mpesaCallback = asyncHandler(async (req, res) => {
    const payload = req.body;
    const parsed = mpesaService.parseCallback(payload);

    // Always respond 200 immediately to Safaricom
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (!parsed.checkoutRequestId) {
        logger.warn('M-Pesa callback without checkoutRequestId');
        return;
    }

    logger.info(`M-Pesa callback: ${parsed.checkoutRequestId} success=${parsed.success} receipt=${parsed.mpesaReceiptNumber || 'N/A'}`);

    // Find payment record
    const payment = await Payment.findOne({
        $or: [
            { checkoutRequestId: parsed.checkoutRequestId },
            { providerRef: parsed.checkoutRequestId },
        ],
    });

    if (payment) {
        payment.status = parsed.success ? 'success' : 'failed';
        payment.providerPayload = payload;
        if (parsed.success && parsed.mpesaReceiptNumber) {
            payment.mpesaReceipt = parsed.mpesaReceiptNumber;
            payment.providerRef = parsed.mpesaReceiptNumber;
        }
        await payment.save();

        try {
            await handleInvoicePayment(payment, parsed);
        } catch (err) {
            logger.error(`Invoice payment handling failed: ${err.message}`);
        }
    } else {
        logger.warn(`Payment not found for ${parsed.checkoutRequestId}`);
    }
});

const mpesaTimeout = asyncHandler(async (req, res) => {
    logger.warn(`M-Pesa timeout: ${JSON.stringify(req.body)}`);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = {
    mpesaCallback,
    mpesaTimeout,
};