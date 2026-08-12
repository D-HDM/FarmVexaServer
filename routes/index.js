const express = require('express');
const router = express.Router();

router.use('/admin', require('./admin'));
router.use('/farm', require('./farm'));
router.use('/internal', require('./internal'));
router.use('/public/chatbot', require('./public/chatbotRoutes'));

module.exports = router;