const router = require('express').Router();
const { getPublicSettings, checkAdminExists, createFirstAdmin } = require('../../controllers/admin/publicController');

router.get('/settings', getPublicSettings);
router.get('/check-admin', checkAdminExists);
router.post('/setup', createFirstAdmin);

module.exports = router;