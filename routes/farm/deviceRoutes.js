const router = require('express').Router();
const { registerDevice, getFarmDevices, getDeviceById, updateDevice, deleteDevice } = require('../../controllers/farm/deviceController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canManageDevices } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/farm/:farmId', ownsFarm, getFarmDevices);
router.get('/:id', getDeviceById);
router.post('/farm/:farmId', ownsFarm, canManageDevices, registerDevice);
router.put('/:id', canManageDevices, updateDevice);
router.delete('/:id', canManageDevices, deleteDevice);

module.exports = router;