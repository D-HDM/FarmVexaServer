const router = require('express').Router();
const { getPrices, getPrice, setPrice, updatePrice, deletePrice, getSuggestedProducts } = require('../../controllers/farm/productPriceController');
const farmerAuth = require('../../middleware/farm/auth');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canAccessFinance } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);

router.get('/farm/:farmId', ownsFarm, getPrices);
router.get('/farm/:farmId/suggested', ownsFarm, getSuggestedProducts);
router.get('/:id', getPrice);
router.post('/farm/:farmId', ownsFarm, canAccessFinance, setPrice);
router.put('/:id', canAccessFinance, updatePrice);
router.delete('/:id', canAccessFinance, deletePrice);

module.exports = router;