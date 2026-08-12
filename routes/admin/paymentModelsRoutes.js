const router = require('express').Router();
const {
    getPaymentModels, getPaymentModel, createPaymentModel, updatePaymentModel, togglePaymentModel, deletePaymentModel,
} = require('../../controllers/admin/paymentController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/', getPaymentModels);
router.get('/:id', getPaymentModel);
router.post('/', createPaymentModel);
router.put('/:id', updatePaymentModel);
router.put('/:id/toggle', togglePaymentModel);
router.delete('/:id', deletePaymentModel);

module.exports = router;