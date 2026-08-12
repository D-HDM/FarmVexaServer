const router = require('express').Router();
const { getPublicSettings, checkAdminExists, createFirstAdmin, getChatbotSettings } = require('../../controllers/admin/publicController');

router.get('/settings', getPublicSettings);
router.get('/chatbot', getChatbotSettings);
router.get('/check-admin', checkAdminExists);
router.post('/setup', createFirstAdmin);

module.exports = router;