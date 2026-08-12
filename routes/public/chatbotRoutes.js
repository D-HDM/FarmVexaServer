const router = require('express').Router();
const { chat } = require('../../controllers/public/chatbotController');

router.post('/chat', chat);

module.exports = router;