const router = require('express').Router();
const { getSettings, updateSettings } = require('../../controllers/admin/settingsController');
const adminAuth = require('../../middleware/admin/adminAuth');
const { requireRole } = require('../../middleware/admin/role');

router.use(adminAuth);

router.get('/', getSettings);
router.put('/', requireRole('super_admin'), updateSettings);

module.exports = router;