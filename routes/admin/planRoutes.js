const router = require('express').Router();
const {
    getUpgradeRequests,
    approveUpgrade,
    rejectUpgrade,
} = require('../../controllers/farm/planController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/upgrades', getUpgradeRequests);
router.put('/upgrades/:id/approve', approveUpgrade);
router.put('/upgrades/:id/reject', rejectUpgrade);

module.exports = router;