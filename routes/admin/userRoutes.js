const router = require('express').Router();
const { getAllUsers, getUserById, toggleUserStatus, deleteUser } = require('../../controllers/admin/userController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id/toggle-status', toggleUserStatus);
router.delete('/:id', deleteUser);

module.exports = router;