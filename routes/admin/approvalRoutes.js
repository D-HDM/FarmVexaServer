const router = require('express').Router();
const {
    getPendingApprovals,
    approveUser,
    rejectUser,
    getApprovalHistory,
    confirmPayment,
} = require('../../controllers/admin/approvalController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/', getPendingApprovals);
router.get('/history', getApprovalHistory);
router.post('/:id/confirm-payment', confirmPayment);
router.put('/:id/approve', approveUser);
router.put('/:id/reject', rejectUser);

module.exports = router;