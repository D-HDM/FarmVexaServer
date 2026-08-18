const express = require('express');
const router = express.Router();
const { getPublicDocuments } = require('../../controllers/admin/publicController');

router.use('/market', require('./marketRoutes'));
router.use('/chatbot', require('./chatbotRoutes'));
router.use('/payment', require('./paymentRoutes'));
router.get('/documents', getPublicDocuments);

module.exports = router;