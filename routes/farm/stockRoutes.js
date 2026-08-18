const router = require('express').Router();
const { getStock, getStockItem, stockIn, stockOut, updateStock, deleteStock, getMovements } = require('../../controllers/farm/stockController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');

router.use(farmerAuth);
router.use(subscriptionCheck);
router.get('/farm/:farmId', ownsFarm, getStock);
router.get('/:id', getStockItem);
router.get('/:id/movements', getMovements);
router.post('/farm/:farmId/in', ownsFarm, stockIn);
router.post('/farm/:farmId/out', ownsFarm, stockOut);
router.put('/:id', updateStock);
router.delete('/:id', deleteStock);

module.exports = router;