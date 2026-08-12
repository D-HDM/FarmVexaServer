const router = require('express').Router();
const { getSystemHealth } = require('../../controllers/admin/healthController');
const adminAuth = require('../../middleware/admin/adminAuth');

router.use(adminAuth);

router.get('/', getSystemHealth);

module.exports = router;