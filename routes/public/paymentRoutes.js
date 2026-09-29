const router = require('express').Router();
const {
    getPaymentMethods,
    sendStkForInvoice,
    checkStkStatus,
    getInvoiceByNumber,
} = require('../../controllers/public/paymentController');

router.get('/methods', getPaymentMethods);
router.post('/stk-invoice', sendStkForInvoice);
router.get('/mpesa-status/:checkoutRequestId', checkStkStatus);
router.get('/invoice/:invoiceNumber', getInvoiceByNumber);

module.exports = router;