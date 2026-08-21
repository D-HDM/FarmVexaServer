const router = require('express').Router();
const {
    getVirtualDeviceSettings,
    updateVirtualDeviceSettings,
    getVirtualDevices,
} = require('../../controllers/admin/virtualDeviceController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/settings', getVirtualDeviceSettings);
router.put('/settings', updateVirtualDeviceSettings);
router.get('/devices', getVirtualDevices);

module.exports = router;