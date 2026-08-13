const router = require('express').Router();
const {
    getMarketStatus, getProducts, getProduct, sendInquiry,
} = require('../../controllers/public/marketController');

router.get('/status', getMarketStatus);
router.get('/products', getProducts);
router.get('/products/:id', getProduct);
router.post('/products/:id/inquire', sendInquiry);

module.exports = router;