const router = require('express').Router();
const {
    getAllPayments,
    getPaymentById,
    verifyPayment,
    rejectPayment,
    getPaymentStats,
} = require('../../controllers/admin/paymentRecordsController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/stats', getPaymentStats);
router.get('/', getAllPayments);
router.get('/:id', getPaymentById);
router.put('/:id/verify', verifyPayment);
router.put('/:id/reject', rejectPayment);

module.exports = router;