const router = require('express').Router();
const {
    startChat,
    sendMessage,
    getMyChats,
    getChatById,
    updateChatTitle,
    deleteChat,
    clearAllChats,
} = require('../../controllers/farm/chatController');
const farmerAuth = require('../../middleware/farm/auth');

router.use(farmerAuth);

router.post('/', startChat);
router.get('/', getMyChats);
router.delete('/clear', clearAllChats);
router.get('/:id', getChatById);
router.post('/:id/message', sendMessage);
router.put('/:id/title', updateChatTitle);
router.delete('/:id', deleteChat);

module.exports = router;