const router = require('express').Router();
const {
    isMarketEnabled, getMyProducts, getMyProduct, addProduct,
    updateProduct, updateProductStatus, deleteProduct,
    getMyInquiries, markInquiryRead, deleteInquiry, uploadMarketImage,
} = require('../../controllers/farm/marketController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const upload = require('../../middleware/global/upload');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/status', isMarketEnabled);
router.get('/products', getMyProducts);
router.get('/products/:id', getMyProduct);
router.post('/products', addProduct);
router.put('/products/:id', updateProduct);
router.put('/products/:id/status', updateProductStatus);
router.delete('/products/:id', deleteProduct);
router.get('/inquiries', getMyInquiries);
router.put('/inquiries/:id/read', markInquiryRead);
router.delete('/inquiries/:id', deleteInquiry);
router.post('/upload-image', upload.single('image'), uploadMarketImage);

module.exports = router;