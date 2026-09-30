const Invoice = require('../models/admin/Invoice');
const Settings = require('../models/admin/Settings');
const paymentInstructionsService = require('./paymentInstructionsService');
const planService = require('./planService');
const logger = require('../utils/logger');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');

function intervalLabel(interval) {
    if (interval === 'once' || interval === 'one_time') return 'One-time';
    if (interval === 'year') return 'Annual';
    if (interval === 'yearly') return 'Annual';
    return 'Monthly';
}

async function createInvoiceWithRetry(data, attempts = 5) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await Invoice.create({
                ...data,
                invoiceNumber: data.invoiceNumber || generateInvoiceNumber(),
            });
        } catch (err) {
            if (err.code !== 11000) throw err;
            logger.warn(`Invoice number collision, attempt ${i + 1}`);
        }
    }
    throw new Error('Could not generate a unique invoice number');
}

async function generateInvoice({
    userId,
    farmId = null,
    user,
    plan,
    planPrice,
    planInterval,
    planDoc = null,
    type = 'registration',
}) {
    if (!userId || !user) {
        throw new Error('userId and user required');
    }

    const settings = await Settings.findOne().lean();
    const dueHours = settings?.invoice?.dueHours || 3;

    const planName = plan || 'Basic';
    let price = Number(planPrice || 0);
    let interval = planInterval || 'one_time';

    if (planDoc) {
        price = Number(planDoc.price ?? price);
        interval = planDoc.interval || interval;
    } else if (!planPrice || !planInterval) {
        const fetched = await planService.getByName(planName);
        if (fetched) {
            price = Number(fetched.price ?? price);
            interval = fetched.interval || interval;
        }
    }

    const label = intervalLabel(interval);

    const issuedAt = new Date();
    const dueDate = new Date(issuedAt.getTime() + dueHours * 60 * 60 * 1000);

    const items = [
        {
            name: `FarmVexa ${planName} Plan`,
            description: label,
            qty: 1,
            unitPrice: price,
            subtotal: price,
        },
    ];

    const subtotal = price;
    const total = subtotal;
    const currency = 'KES';

    const invoiceNumber = generateInvoiceNumber();

    const instructions = await paymentInstructionsService.getPaymentInstructions({
        amount: total,
        currency,
        invoiceNumber,
    });

    const invoice = await createInvoiceWithRetry({
        invoiceNumber,
        user: userId,
        farm: farmId,
        plan: planName,
        planInterval: interval,
        type,
        items,
        subtotal,
        discount: 0,
        tax: 0,
        total,
        amountPaid: 0,
        amountDue: total,
        currency,
        customerSnapshot: {
            name: user.name,
            email: user.email,
            phone: user.phone || null,
        },
        status: 'sent',
        dueDate,
        issuedAt,
        sentAt: issuedAt,
        notes: `${type === 'registration' ? 'Registration' : type === 'renewal' ? 'Renewal' : 'Upgrade'} invoice. Payment due within ${dueHours} hours.`,
        paymentInstructions: instructions,
    });

    logger.info(`Invoice created: ${invoice.invoiceNumber} for user ${userId}`);

    return { invoice, instructions };
}

module.exports = { generateInvoice, createInvoiceWithRetry };