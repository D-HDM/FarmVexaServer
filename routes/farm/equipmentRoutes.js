const router = require('express').Router();
const { getEquipment, getOne, addEquipment, updateEquipment, recordMaintenance, deleteEquipment } = require('../../controllers/farm/equipmentController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canManageInventory } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/farm/:farmId', ownsFarm, getEquipment);
router.get('/:id', getOne);
router.post('/farm/:farmId', ownsFarm, canManageInventory, addEquipment);
router.put('/:id', canManageInventory, updateEquipment);
router.put('/:id/maintenance', canManageInventory, recordMaintenance);
router.delete('/:id', canManageInventory, deleteEquipment);

module.exports = router;