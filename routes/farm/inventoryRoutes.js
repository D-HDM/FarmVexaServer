const router = require('express').Router();
const { getItems, getItem, addItem, updateItem, stockIn, stockOut, deleteItem } = require('../../controllers/farm/inventoryController');
const farmerAuth = require('../../middleware/farm/auth');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canManageInventory } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);

router.get('/farm/:farmId', ownsFarm, getItems);
router.get('/:id', getItem);
router.post('/farm/:farmId', ownsFarm, canManageInventory, addItem);
router.put('/:id', canManageInventory, updateItem);
router.put('/:id/stock-in', canManageInventory, stockIn);
router.put('/:id/stock-out', canManageInventory, stockOut);
router.delete('/:id', canManageInventory, deleteItem);

module.exports = router;