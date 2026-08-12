const axios = require('axios');
const PaymentMethod = require('../models/admin/PaymentMethod');
const logger = require('../utils/logger');

class MpesaService {
    constructor() {
        this.baseURL = process.env.MPESA_ENV === 'production'
            ? 'https://api.safaricom.co.ke'
            : 'https://sandbox.safaricom.co.ke';
        this.shortcode = process.env.MPESA_SHORTCODE;
        this.passkey = process.env.MPESA_PASSKEY;
        this.consumerKey = process.env.MPESA_CONSUMER_KEY;
        this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
        this.callbackURL = `${process.env.API_URL}/api/internal/mpesa/callback`;
    }

    async getAccessToken() {
        const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
        const res = await axios.get(
            `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
            { headers: { Authorization: `Basic ${auth}` } }
        );
        return res.data.access_token;
    }

    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
        if (cleaned.startsWith('254')) return cleaned;
        return `254${cleaned}`;
    }

    async stkPush(phone, amount, reference = 'FarmVexa') {
        const method = await PaymentMethod.findOne({ type: 'mpesa_stk', enabled: true });
        if (!method) throw new Error('M-Pesa STK not configured');

        const token = await this.getAccessToken();
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
        const phoneNumber = this.formatPhone(phone);

        const response = await axios.post(
            `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
            {
                BusinessShortCode: this.shortcode,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: Math.round(amount),
                PartyA: phoneNumber,
                PartyB: this.shortcode,
                PhoneNumber: phoneNumber,
                CallBackURL: this.callbackURL,
                AccountReference: reference.substring(0, 12),
                TransactionDesc: 'FarmVexa Payment',
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        logger.info(`STK Push sent to ${phoneNumber} for KES ${amount}`);
        return response.data;
    }

    async stkQuery(checkoutRequestID) {
        const token = await this.getAccessToken();
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');

        const response = await axios.post(
            `${this.baseURL}/mpesa/stkpushquery/v1/query`,
            {
                BusinessShortCode: this.shortcode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        return response.data;
    }

    async sendMoney(phone, amount, remarks = 'FarmVexa') {
        const method = await PaymentMethod.findOne({ type: 'mpesa_send_money', enabled: true });
        if (!method) throw new Error('M-Pesa Send Money not configured');

        const token = await this.getAccessToken();
        const phoneNumber = this.formatPhone(phone);

        const response = await axios.post(
            `${this.baseURL}/mpesa/b2c/v1/paymentrequest`,
            {
                InitiatorName: this.shortcode,
                SecurityCredential: this.passkey,
                CommandID: 'BusinessPayment',
                Amount: Math.round(amount),
                PartyA: this.shortcode,
                PartyB: phoneNumber,
                Remarks: remarks,
                QueueTimeOutURL: `${process.env.API_URL}/api/internal/mpesa/timeout`,
                ResultURL: `${process.env.API_URL}/api/internal/mpesa/result`,
                Occasion: remarks,
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );

        logger.info(`Send Money to ${phoneNumber} for KES ${amount}`);
        return response.data;
    }
}

module.exports = new MpesaService();