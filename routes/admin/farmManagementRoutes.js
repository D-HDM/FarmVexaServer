const router = require('express').Router();
const { getAllFarms, getFarmById, approveFarm, suspendFarm, updateSubscription } = require('../../controllers/admin/farmManagementController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/', getAllFarms);
router.get('/:id', getFarmById);
router.put('/:id/approve', approveFarm);
router.put('/:id/suspend', suspendFarm);
router.put('/:id/subscription', updateSubscription);

module.exports = router;