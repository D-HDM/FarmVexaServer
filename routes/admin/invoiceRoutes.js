const router = require('express').Router();
const {
    getAllInvoices,
    getInvoiceById,
    cancelInvoice,
    getInvoiceStats,
    getInvoiceByUser,
} = require('../../controllers/admin/invoiceController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/stats', getInvoiceStats);
router.get('/user/:userId', getInvoiceByUser);
router.get('/', getAllInvoices);
router.get('/:id', getInvoiceById);
router.put('/:id/cancel', cancelInvoice);

module.exports = router;