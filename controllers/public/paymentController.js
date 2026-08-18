const User = require('../../models/farm/User');
const PaymentRecord = require('../../models/admin/PaymentRecord');
const mpesaService = require('../../services/mpesaService');
const emailService = require('../../services/emailService');
const smsService = require('../../services/smsService');
const Admin = require('../../models/admin/Admin');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const logger = require('../../utils/logger');

const initiateStkPush = asyncHandler(async (req, res) => {
    const { phone, amount, plan, registrationData } = req.body;

    if (!phone) return errorResponse(res, 'Phone number is required', 400);
    if (!amount) return errorResponse(res, 'Amount is required', 400);

    try {
        const result = await mpesaService.stkPush(phone, amount, plan || 'FarmVexa');

        await PaymentRecord.create({
            phone,
            amount,
            plan,
            type: 'registration',
            reference: result.CheckoutRequestID || result.MerchantRequestID,
            status: 'pending',
            registrationData,
            methodType: 'mpesa_stk',
        });

        return successResponse(res, {
            checkoutRequestID: result.CheckoutRequestID,
            merchantRequestID: result.MerchantRequestID,
            message: result.CustomerMessage || 'STK Push sent',
        }, 'STK Push initiated');
    } catch (error) {
        logger.error(`STK Push failed: ${error.message}`);
        return errorResponse(res, error.response?.data?.errorMessage || error.message || 'STK Push failed', 500);
    }
});

const registerWithPayment = asyncHandler(async (req, res) => {
    const { name, email, phone, password, county, subCounty, plan, paymentMethod, paymentReference, amount, interval } = req.body;

    if (!name || !email || !phone || !password || !plan) {
        return errorResponse(res, 'All fields are required', 400);
    }

    const existing = await User.findOne({ email });
    if (existing) return errorResponse(res, 'Email already registered', 400);

    const planInterval = interval || (plan === 'Basic Monthly' ? 'monthly' : 'one_time');
    const planAmount = amount || 0;

    const user = await User.create({
        name,
        email,
        phone,
        password,
        county,
        subCounty,
        role: 'farmer',
        approvalStatus: 'pending',
        isActive: false,
        selectedPlan: plan,
        planInterval,
        planPrice: planAmount,
        paymentStatus: paymentMethod ? 'pending_verification' : 'unpaid',
        paymentMethod: paymentMethod || null,
        paymentReference: paymentReference || null,
        paymentDate: new Date(),
    });

    const paymentRecord = await PaymentRecord.create({
        user: user._id,
        email,
        phone,
        amount: planAmount,
        plan,
        type: 'registration',
        reference: paymentReference || 'MANUAL',
        status: paymentMethod ? 'pending_verification' : 'unpaid',
        methodType: paymentMethod || 'manual',
        registrationData: { name, email, phone, county, subCounty },
    });

    // ============ SEND EMAILS (FLATTENED DATA) ============

    // 1. Farmer — Registration Pending
    try {
        await emailService.send(email, 'farmerRegistrationPending', {
            user: { name, email, phone },
            name,
            email,
            phone,
            county,
            subCounty,
            planName: plan,
            amount: planAmount,
            interval: planInterval,
            paymentMethod,
            reference: paymentReference || 'STK Pending',
        });
        logger.info(`Registration pending email sent to ${email}`);
    } catch (emailError) {
        logger.error(`Registration pending email failed: ${emailError.message}`);
    }

    // 2. Admin — New Farmer
    try {
        const admins = await Admin.find({ isActive: true });
        for (const admin of admins) {
            await emailService.send(admin.email, 'adminNewFarmer', {
                user: { name: admin.name, email: admin.email },
                farmer: { name, email, phone },
                planName: plan,
                amount: planAmount,
                paymentMethod,
                reference: paymentReference || 'STK Pending',
            });
        }
        logger.info(`New farmer email sent to admins for ${email}`);
    } catch (adminEmailError) {
        logger.error(`Admin new farmer email failed: ${adminEmailError.message}`);
    }

    // 3. Admin — Payment Received (only if payment method)
    if (paymentMethod) {
        try {
            const admins = await Admin.find({ isActive: true });
            for (const admin of admins) {
                await emailService.send(admin.email, 'adminPaymentReceived', {
                    user: { name: admin.name, email: admin.email },
                    farmer: { name, email, phone },
                    planName: plan,
                    amount: planAmount,
                    paymentMethod,
                    reference: paymentReference || 'STK Pending',
                });
            }
            logger.info(`Payment received email sent to admins for ${email}`);
        } catch (paymentEmailError) {
            logger.error(`Payment received email failed: ${paymentEmailError.message}`);
        }
    }

    // ============ SEND SMS ============

    // 1. Farmer — Registration Pending SMS
    try {
        await smsService.send(phone, 'farmerRegistrationPending', {
            user: { name, phone },
            planName: plan,
            amount: planAmount,
        });
        logger.info(`Registration pending SMS sent to ${phone}`);
    } catch (smsError) {
        logger.error(`Registration pending SMS failed: ${smsError.message}`);
    }

    // 2. Admin — New Farmer SMS
    try {
        const admins = await Admin.find({ isActive: true, phone: { $exists: true, $ne: '' } });
        for (const admin of admins) {
            await smsService.send(admin.phone, 'adminNewFarmer', {
                user: { name: admin.name, phone: admin.phone },
                farmer: { name, email, phone },
                planName: plan,
            });
        }
        logger.info(`New farmer SMS sent to admins for ${email}`);
    } catch (adminSmsError) {
        logger.error(`Admin new farmer SMS failed: ${adminSmsError.message}`);
    }

    // 3. Admin — Payment Received SMS
    if (paymentMethod) {
        try {
            const admins = await Admin.find({ isActive: true, phone: { $exists: true, $ne: '' } });
            for (const admin of admins) {
                await smsService.send(admin.phone, 'adminPaymentReceived', {
                    user: { name: admin.name, phone: admin.phone },
                    farmer: { name, email, phone },
                    planName: plan,
                    amount: planAmount,
                    reference: paymentReference || 'STK Pending',
                });
            }
            logger.info(`Payment received SMS sent to admins for ${email}`);
        } catch (paymentSmsError) {
            logger.error(`Payment received SMS failed: ${paymentSmsError.message}`);
        }
    }

    logger.info(`New pending farmer registered: ${email} (${plan})`);

    return successResponse(res, {
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            approvalStatus: user.approvalStatus,
        },
    }, 'Registration submitted. Awaiting approval.', 201);
});

const checkPaymentStatus = asyncHandler(async (req, res) => {
    const { email } = req.params;

    const payment = await PaymentRecord.findOne({ email }).sort({ createdAt: -1 });
    if (!payment) return errorResponse(res, 'No payment record found', 404);

    return successResponse(res, {
        status: payment.status,
        plan: payment.plan,
        amount: payment.amount,
        reference: payment.reference,
        createdAt: payment.createdAt,
    });
});

module.exports = {
    initiateStkPush,
    registerWithPayment,
    checkPaymentStatus,
};