const Invoice = require('../../models/admin/Invoice');
const Payment = require('../../models/admin/Payment');
const User = require('../../models/farm/User');
const mpesaService = require('../../services/mpesaService');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

async function markInvoicePaid(invoice, parsed) {
    invoice.status = 'paid';
    invoice.amountPaid = parsed.amount || invoice.amountDue;
    invoice.amountDue = 0;
    invoice.paidAt = new Date();
    invoice.paymentMethod = 'mpesa_stk';
    invoice.paymentRef = parsed.mpesaReceiptNumber || null;
    await invoice.save();
}

async function markUserPaid(userId) {
    const user = await User.findById(userId);
    if (!user) return null;
    user.paymentStatus = 'paid';
    await user.save();
    return user;
}

async function notifyFarmer(user, invoice, parsed) {
    if (!user) return;

    try {
        await emailService.send(user.email, 'farmerPaymentReceived', {
            user,
            name: user.name,
            invoiceNumber: invoice.invoiceNumber,
            amount: parsed.amount || invoice.amountPaid,
            currency: invoice.currency,
            paidAt: new Date(),
            paymentMethod: 'mpesa_stk',
            paymentReference: parsed.mpesaReceiptNumber,
        });
    } catch (err) {
        logger.error(`Payment email failed: ${err.message}`);
    }

    if (user.phone) {
        try {
            await smsService.send(user.phone, 'farmerPaymentReceived', {
                user,
                invoiceNumber: invoice.invoiceNumber,
                amount: parsed.amount,
            });
        } catch (err) {
            logger.error(`Payment SMS failed: ${err.message}`);
        }
    }
}

async function notifyAdmins(invoice, user, parsed) {
    try {
        const Admin = require('../../models/admin/Admin');
        const admins = await Admin.find({ isActive: true });

        for (const admin of admins) {
            await emailService.send(admin.email, 'adminPaymentReceived', {
                user: { name: admin.name, email: admin.email },
                farmer: { name: user?.name, email: user?.email, phone: user?.phone },
                invoiceNumber: invoice.invoiceNumber,
                planName: invoice.plan,
                amount: invoice.amountPaid,
                paymentMethod: 'mpesa_stk',
                reference: parsed.mpesaReceiptNumber,
            });
        }
    } catch (err) {
        logger.error(`Admin payment notification failed: ${err.message}`);
    }
}

async function handleSuccess(payment, parsed) {
    const invoice = payment.invoice
        ? await Invoice.findById(payment.invoice)
        : await Invoice.findOne({ 'stkLastRequest.checkoutRequestId': parsed.checkoutRequestId });

    if (!invoice) {
        logger.warn(`Invoice not found for checkoutRequestId ${parsed.checkoutRequestId}`);
        return;
    }

    await markInvoicePaid(invoice, parsed);
    const user = await markUserPaid(invoice.user);

    logger.info(`Invoice ${invoice.invoiceNumber} paid. Receipt: ${parsed.mpesaReceiptNumber}`);

    await notifyFarmer(user, invoice, parsed);
    await notifyAdmins(invoice, user, parsed);
}

async function handleFailure(payment, parsed) {
    const invoice = payment.invoice
        ? await Invoice.findById(payment.invoice)
        : await Invoice.findOne({ 'stkLastRequest.checkoutRequestId': parsed.checkoutRequestId });

    if (!invoice) {
        logger.warn(`Invoice not found for failed payment ${parsed.checkoutRequestId}`);
        return;
    }

    invoice.status = 'failed';
    invoice.paymentMethod = 'mpesa_stk';
    invoice.paymentRef = parsed.resultDesc || 'Failed';
    await invoice.save();

    logger.warn(`Invoice ${invoice.invoiceNumber} payment failed: ${parsed.resultDesc}`);
}

const mpesaCallback = asyncHandler(async (req, res) => {
    const payload = req.body;
    const parsed = mpesaService.parseCallback(payload);

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (!parsed.checkoutRequestId) {
        logger.warn('M-Pesa callback without checkoutRequestId');
        return;
    }

    logger.info(`M-Pesa callback: ${parsed.checkoutRequestId} success=${parsed.success} receipt=${parsed.mpesaReceiptNumber || 'N/A'}`);

    const payment = await Payment.findOne({
        $or: [
            { checkoutRequestId: parsed.checkoutRequestId },
            { providerRef: parsed.checkoutRequestId },
        ],
    });

    if (!payment) {
        logger.warn(`Payment not found for ${parsed.checkoutRequestId}`);
        return;
    }

    payment.status = parsed.success ? 'success' : 'failed';
    payment.providerPayload = payload;
    if (parsed.success && parsed.mpesaReceiptNumber) {
        payment.mpesaReceipt = parsed.mpesaReceiptNumber;
        payment.providerRef = parsed.mpesaReceiptNumber;
    }
    await payment.save();

    try {
        if (parsed.success) {
            await handleSuccess(payment, parsed);
        } else {
            await handleFailure(payment, parsed);
        }
    } catch (err) {
        logger.error(`Payment handling failed: ${err.message}`);
    }
});

const mpesaTimeout = asyncHandler(async (req, res) => {
    logger.warn(`M-Pesa timeout: ${JSON.stringify(req.body)}`);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = { mpesaCallback, mpesaTimeout };