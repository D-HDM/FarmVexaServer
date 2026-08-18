const router = require('express').Router();
const {
    getRenewalRequests,
    approveRenewal,
    rejectRenewal,
} = require('../../controllers/farm/renewalController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/', getRenewalRequests);
router.put('/:id/approve', approveRenewal);
router.put('/:id/reject', rejectRenewal);

module.exports = router;