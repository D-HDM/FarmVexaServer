const express = require('express');
const router = express.Router();
const {
    initiateStkPush,
    registerWithPayment,
    checkPaymentStatus,
} = require('../../controllers/public/paymentController');

router.post('/stk-push', initiateStkPush);
router.post('/register', registerWithPayment);
router.get('/status/:email', checkPaymentStatus);

module.exports = router;