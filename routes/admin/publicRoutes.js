const router = require('express').Router();
const { getPublicSettings, checkAdminExists, createFirstAdmin,getPublicDocuments , getChatbotSettings } = require('../../controllers/admin/publicController');

router.get('/settings', getPublicSettings);
router.get('/chatbot', getChatbotSettings);
router.get('/check-admin', checkAdminExists);
router.post('/setup', createFirstAdmin);
router.get('/documents', getPublicDocuments);

module.exports = router;