const express = require('express');
const router = express.Router();

router.use('/market', require('./marketRoutes'));
router.use('/chatbot', require('./chatbotRoutes'));

module.exports = router;