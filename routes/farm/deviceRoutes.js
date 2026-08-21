const router = require('express').Router();
const { registerDevice, getFarmDevices, getDeviceById, updateDevice, deleteDevice } = require('../../controllers/farm/deviceController');
const VirtualDevice = require('../../models/farm/VirtualDevice');
const Farm = require('../../models/farm/Farm');
const User = require('../../models/farm/User');
const Settings = require('../../models/admin/Settings');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canManageDevices } = require('../../middleware/farm/farmRole');
const { successResponse, errorResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

router.use(farmerAuth);
router.use(subscriptionCheck);

// Virtual devices — MUST come before /:id
router.get('/virtual', asyncHandler(async (req, res) => {
    const settings = await Settings.findOne();
    const virtualSettings = settings?.virtualDevice || {};

    // If disabled globally — return empty
    if (!virtualSettings.enabled) {
        return successResponse(res, { devices: [] });
    }

    // Check if user's plan is allowed
    const user = await User.findById(req.user.id);
    const planAllowed = virtualSettings.showForPlans?.[user?.selectedPlan];
    if (!planAllowed) {
        return successResponse(res, { devices: [] });
    }

    // Get virtual devices for user's farms
    const farms = await Farm.find({ owner: req.user.id }).select('_id').lean();
    const farmIds = farms.map(f => f._id);
    const devices = await VirtualDevice.find({ farm: { $in: farmIds } })
        .populate('farm', 'name')
        .lean();
    
    return successResponse(res, { devices });
}));

router.get('/farm/:farmId', ownsFarm, getFarmDevices);
router.get('/:id', getDeviceById);
router.post('/farm/:farmId', ownsFarm, canManageDevices, registerDevice);
router.put('/:id', canManageDevices, updateDevice);
router.delete('/:id', canManageDevices, deleteDevice);

module.exports = router;