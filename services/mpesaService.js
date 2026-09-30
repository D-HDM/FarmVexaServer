const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Settings = require('../models/admin/Settings');
const { env } = require('../config/env');
const logger = require('../utils/logger');

const MPESA_LOG = path.join(__dirname, '..', 'logs', 'mpesa.log');
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
const redact = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const clone = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const k of ['Password', 'passkey', 'consumerSecret']) {
        if (k in clone) clone[k] = '***';
    }
    return clone;
};

let CONFIG = {
    baseUrl: env.mpesa.baseUrl,
    consumerKey: env.mpesa.consumerKey,
    consumerSecret: env.mpesa.consumerSecret,
    shortcode: env.mpesa.shortcode,
    tillNumber: env.mpesa.tillNumber,
    passkey: env.mpesa.passkey,
    callbackUrl: env.mpesa.callbackUrl,
    transactionType: env.mpesa.transactionType,
};

async function loadFromSettings() {
    try {
        const settings = await Settings.findOne().lean();
        const m = settings?.mpesa || {};
        if (m.enabled && m.consumerKey && m.consumerSecret) {
            CONFIG = {
                baseUrl: m.baseUrl || CONFIG.baseUrl,
                consumerKey: m.consumerKey || CONFIG.consumerKey,
                consumerSecret: m.consumerSecret || CONFIG.consumerSecret,
                shortcode: m.shortcode || CONFIG.shortcode,
                tillNumber: m.tillNumber || CONFIG.tillNumber,
                passkey: m.passkey || CONFIG.passkey,
                callbackUrl: m.callbackUrl || CONFIG.callbackUrl,
                transactionType: m.transactionType || CONFIG.transactionType,
            };
            mlog('CONFIG LOADED FROM SETTINGS', {
                baseUrl: CONFIG.baseUrl,
                shortcode: CONFIG.shortcode,
                tillNumber: CONFIG.tillNumber,
                transactionType: CONFIG.transactionType,
                callbackUrl: CONFIG.callbackUrl,
            });
        } else {
            mlog('CONFIG FROM ENV', {
                baseUrl: CONFIG.baseUrl,
                shortcode: CONFIG.shortcode,
                tillNumber: CONFIG.tillNumber,
                transactionType: CONFIG.transactionType,
                callbackUrl: CONFIG.callbackUrl,
            });
        }
    } catch (err) {
        mlog('CONFIG LOAD ERROR', err.message);
    }
}

function configure(overrides = {}) {
    CONFIG = { ...CONFIG, ...overrides };
}

let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
    const now = Date.now();
    if (tokenCache.token && tokenCache.expiresAt > now + 60000) {
        return tokenCache.token;
    }

    if (!CONFIG.consumerKey || !CONFIG.consumerSecret) {
        throw new Error('M-PESA credentials not configured');
    }

    const auth = Buffer.from(`${CONFIG.consumerKey}:${CONFIG.consumerSecret}`).toString('base64');

    mlog('OAUTH REQUEST', {
        url: `${CONFIG.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    });

    try {
        const { data } = await axios.get(
            `${CONFIG.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
            { headers: { Authorization: `Basic ${auth}` }, timeout: 15000 }
        );

        tokenCache = {
            token: data.access_token,
            expiresAt: now + Number(data.expires_in) * 1000,
        };

        mlog('OAUTH RESPONSE', {
            expires_in: data.expires_in,
            token_preview: data.access_token ? `${String(data.access_token).slice(0, 12)}...` : null,
        });

        return data.access_token;
    } catch (error) {
        const err = error.response?.data || error.message;
        mlog('OAUTH ERROR', err);
        throw new Error(`M-PESA OAuth failed: ${typeof err === 'string' ? err : JSON.stringify(err)}`);
    }
}

function getTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return (
        d.getFullYear() +
        pad(d.getMonth() + 1) +
        pad(d.getDate()) +
        pad(d.getHours()) +
        pad(d.getMinutes()) +
        pad(d.getSeconds())
    );
}

function generatePassword(timestamp) {
    return Buffer.from(`${CONFIG.shortcode}${CONFIG.passkey}${timestamp}`).toString('base64');
}

function normalizePhone(phone) {
    let p = String(phone).replace(/\D/g, '');
    if (p.startsWith('0')) p = '254' + p.slice(1);
    else if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
    return p;
}

async function initiateSTKPush({ phone, amount, accountReference = 'Invoice', description = 'FarmVexa Payment' }) {
    await loadFromSettings();
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);
    const normalizedPhone = normalizePhone(phone);
    const partyB = CONFIG.tillNumber || CONFIG.shortcode;

    const payload = {
        BusinessShortCode: CONFIG.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: CONFIG.transactionType,
        Amount: Math.round(amount),
        PartyA: normalizedPhone,
        PartyB: partyB,
        PhoneNumber: normalizedPhone,
        CallBackURL: CONFIG.callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: description,
    };

    mlog('STK REQUEST', {
        url: `${CONFIG.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload: redact(payload),
    });

    try {
        const { data } = await axios.post(
            `${CONFIG.baseUrl}/mpesa/stkpush/v1/processrequest`,
            payload,
            {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 30000,
            }
        );

        mlog('STK RESPONSE', data);

        return {
            success: true,
            merchantRequestId: data.MerchantRequestID,
            checkoutRequestId: data.CheckoutRequestID,
            responseCode: data.ResponseCode,
            responseDescription: data.ResponseDescription,
            customerMessage: data.CustomerMessage,
        };
    } catch (error) {
        const err = error.response?.data || error.message;
        mlog('STK ERROR', err);
        return { success: false, error: err };
    }
}

async function querySTKStatus(checkoutRequestId) {
    await loadFromSettings();
    const token = await getAccessToken();
    const timestamp = getTimestamp();
    const password = generatePassword(timestamp);

    const payload = {
        BusinessShortCode: CONFIG.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
    };

    mlog('QUERY REQUEST', {
        checkoutRequestId,
        url: `${CONFIG.baseUrl}/mpesa/stkpushquery/v1/query`,
    });

    try {
        const { data } = await axios.post(
            `${CONFIG.baseUrl}/mpesa/stkpushquery/v1/query`,
            payload,
            {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                timeout: 30000,
            }
        );

        mlog('QUERY RESPONSE', { checkoutRequestId, response: data });

        return {
            success: true,
            resultCode: data.ResultCode,
            resultDesc: data.ResultDesc,
            responseCode: data.ResponseCode,
        };
    } catch (error) {
        const err = error.response?.data || error.message;
        mlog('QUERY ERROR', { checkoutRequestId, error: err });
        return { success: false, error: err };
    }
}

function parseCallback(body) {
    const cb = body?.Body?.stkCallback;
    if (!cb) return { success: false, error: 'Invalid callback payload' };

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc } = cb;

    if (ResultCode !== 0) {
        return {
            success: false,
            merchantRequestId: MerchantRequestID,
            checkoutRequestId: CheckoutRequestID,
            resultCode: ResultCode,
            resultDesc: ResultDesc,
        };
    }

    const items = cb.CallbackMetadata?.Item || [];
    const get = (name) => items.find((i) => i.Name === name)?.Value;

    return {
        success: true,
        merchantRequestId: MerchantRequestID,
        checkoutRequestId: CheckoutRequestID,
        resultCode: ResultCode,
        resultDesc: ResultDesc,
        amount: get('Amount'),
        mpesaReceiptNumber: get('MpesaReceiptNumber'),
        transactionDate: get('TransactionDate'),
        phoneNumber: get('PhoneNumber'),
    };
}

const SAFARICOM_IPS = [
    '196.201.214.200', '196.201.214.206', '196.201.213.114',
    '196.201.214.207', '196.201.214.208', '196.201.213.44',
    '196.201.212.127', '196.201.212.138', '196.201.212.129',
    '196.201.212.136', '196.201.212.74', '196.201.212.69',
];

function isSafaricomIp(ip) {
    if (!ip) return false;
    const clean = ip.replace('::ffff:', '').split(',')[0].trim();
    return SAFARICOM_IPS.includes(clean);
}

module.exports = {
    configure,
    getAccessToken,
    initiateSTKPush,
    querySTKStatus,
    parseCallback,
    normalizePhone,
    isSafaricomIp,
    getConfig: () => ({ ...CONFIG }),
};