const router = require('express').Router();
const {
    getMarketStatus, toggleMarket, getFarmers,
    getProducts, getProduct, deleteProduct, getInquiries,
} = require('../../controllers/admin/marketController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/status', getMarketStatus);
router.put('/toggle', toggleMarket);
router.get('/farmers', getFarmers);
router.get('/products', getProducts);
router.get('/products/:id', getProduct);
router.delete('/products/:id', deleteProduct);
router.get('/inquiries', getInquiries);

module.exports = router;