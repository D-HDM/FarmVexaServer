const router = require('express').Router();
const logger = require('../../utils/logger');

router.post('/callback', (req, res) => {
    logger.info('M-Pesa Callback:', JSON.stringify(req.body));
    const { Body } = req.body;
    if (Body?.stkCallback?.ResultCode === 0) {
        logger.info('Payment successful:', Body.stkCallback.CheckoutRequestID);
    }
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

router.post('/timeout', (req, res) => {
    logger.info('M-Pesa Timeout:', JSON.stringify(req.body));
    res.json({ accepted: true });
});

router.post('/result', (req, res) => {
    logger.info('M-Pesa Result:', JSON.stringify(req.body));
    res.json({ accepted: true });
});

module.exports = router;