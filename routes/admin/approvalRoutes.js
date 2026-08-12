const router = require('express').Router();
const {
    getPendingApprovals,
    approveUser,
    rejectUser,
    getApprovalHistory,
} = require('../../controllers/admin/approvalController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/pending', getPendingApprovals);
router.get('/history', getApprovalHistory);
router.put('/:id/approve', approveUser);
router.put('/:id/reject', rejectUser);

module.exports = router;