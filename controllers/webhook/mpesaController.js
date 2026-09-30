const fs = require('fs');
const path = require('path');
const Invoice = require('../../models/admin/Invoice');
const Payment = require('../../models/admin/Payment');
const User = require('../../models/farm/User');
const mpesaService = require('../../services/mpesaService');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const MPESA_LOG = path.join(__dirname, '..', '..', 'logs', 'mpesa.log');
const ensureLogDir = () => {
    const dir = path.dirname(MPESA_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};
const mlog = (label, data) => {
    try {
        ensureLogDir();
        const body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        const line = `[${new Date().toISOString()}] ${label}\n${body}\n${'─'.repeat(60)}\n`;
        fs.appendFileSync(MPESA_LOG, line, 'utf8');
    } catch {}
    console.log(`[MPESA] ${label}`, data ?? '');
};

async function markInvoicePaid(invoice, parsed) {
    invoice.status = 'paid';
    invoice.amountPaid = parsed.amount || invoice.amountDue;
    invoice.amountDue = 0;
    invoice.paidAt = new Date();
    invoice.paymentMethod = 'mpesa_stk';
    invoice.paymentRef = parsed.mpesaReceiptNumber || null;
    await invoice.save();
}

async function markUserPaid(userId, parsed, payment) {
    const user = await User.findById(userId);
    if (!user) return null;
    user.paymentStatus = 'paid';
    user.paymentMethod = payment?.method || 'mpesa_stk';
    user.paymentReference = parsed?.mpesaReceiptNumber || payment?.providerRef || null;
    user.paymentDate = new Date();
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
        mlog('HANDLE SUCCESS — INVOICE NOT FOUND', { checkoutRequestId: parsed.checkoutRequestId });
        return;
    }

    await markInvoicePaid(invoice, parsed);
    const user = await markUserPaid(invoice.user, parsed, payment);

    mlog('INVOICE MARKED PAID', {
        invoiceNumber: invoice.invoiceNumber,
        amountPaid: invoice.amountPaid,
        receipt: parsed.mpesaReceiptNumber,
        userId: String(invoice.user),
        userPaymentReference: user?.paymentReference,
        userPaymentMethod: user?.paymentMethod,
    });

    await notifyFarmer(user, invoice, parsed);
    await notifyAdmins(invoice, user, parsed);
}

async function handleFailure(payment, parsed) {
    const invoice = payment.invoice
        ? await Invoice.findById(payment.invoice)
        : await Invoice.findOne({ 'stkLastRequest.checkoutRequestId': parsed.checkoutRequestId });

    if (!invoice) {
        mlog('HANDLE FAILURE — INVOICE NOT FOUND', { checkoutRequestId: parsed.checkoutRequestId });
        return;
    }

    invoice.status = 'failed';
    invoice.paymentMethod = 'mpesa_stk';
    invoice.paymentRef = parsed.resultDesc || 'Failed';
    await invoice.save();

    mlog('INVOICE MARKED FAILED', {
        invoiceNumber: invoice.invoiceNumber,
        resultCode: parsed.resultCode,
        resultDesc: parsed.resultDesc,
    });
}

const mpesaCallback = asyncHandler(async (req, res) => {
    const payload = req.body;

    mlog('CALLBACK RECEIVED', {
        headers: {
            'content-type': req.headers['content-type'],
            'user-agent': req.headers['user-agent'],
            'x-forwarded-for': req.headers['x-forwarded-for'] || req.ip,
        },
        body: payload,
    });

    const parsed = mpesaService.parseCallback(payload);

    mlog('CALLBACK PARSED', {
        checkoutRequestId: parsed.checkoutRequestId,
        merchantRequestId: parsed.merchantRequestId,
        success: parsed.success,
        resultCode: parsed.resultCode,
        resultDesc: parsed.resultDesc,
        mpesaReceipt: parsed.mpesaReceiptNumber,
        amount: parsed.amount,
        phoneNumber: parsed.phoneNumber,
    });

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });

    if (!parsed.checkoutRequestId) {
        mlog('CALLBACK WITHOUT CHECKOUT REQUEST ID', payload);
        return;
    }

    const payment = await Payment.findOne({
        $or: [
            { checkoutRequestId: parsed.checkoutRequestId },
            { providerRef: parsed.checkoutRequestId },
        ],
    });

    if (!payment) {
        mlog('CALLBACK — PAYMENT NOT FOUND', { checkoutRequestId: parsed.checkoutRequestId });
        return;
    }

    payment.status = parsed.success ? 'success' : 'failed';
    payment.providerPayload = payload;
    if (parsed.success && parsed.mpesaReceiptNumber) {
        payment.mpesaReceipt = parsed.mpesaReceiptNumber;
        payment.providerRef = parsed.mpesaReceiptNumber;
    }
    await payment.save();

    mlog('PAYMENT UPDATED', { paymentId: String(payment._id), status: payment.status });

    try {
        if (parsed.success) {
            await handleSuccess(payment, parsed);
        } else {
            await handleFailure(payment, parsed);
        }
    } catch (err) {
        mlog('CALLBACK HANDLING ERROR', err.message);
        logger.error(`Payment handling failed: ${err.message}`);
    }
});

const mpesaTimeout = asyncHandler(async (req, res) => {
    mlog('CALLBACK TIMEOUT', req.body);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

module.exports = { mpesaCallback, mpesaTimeout };