const router = require('express').Router();
const { login, getProfile, updateProfile, changePassword, createAdmin, getAllAdmins, toggleAdminStatus, deleteAdmin } = require('../../controllers/admin/adminController');
const adminAuth = require('../../middleware/admin/adminAuth');
const { requireRole } = require('../../middleware/admin/role');

router.post('/login', login);

router.use(adminAuth);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);

router.use(requireRole('super_admin'));

router.post('/', createAdmin);
router.get('/', getAllAdmins);
router.put('/:id/toggle-status', toggleAdminStatus);
router.delete('/:id', deleteAdmin);

module.exports = router;