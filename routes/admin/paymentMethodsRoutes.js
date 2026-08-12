const router = require('express').Router();
const {
    getPaymentMethods, getPaymentMethod, createPaymentMethod, updatePaymentMethod, togglePaymentMethod, deletePaymentMethod,
} = require('../../controllers/admin/paymentController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/', getPaymentMethods);
router.get('/:id', getPaymentMethod);
router.post('/', createPaymentMethod);
router.put('/:id', updatePaymentMethod);
router.put('/:id/toggle', togglePaymentMethod);
router.delete('/:id', deletePaymentMethod);

module.exports = router;