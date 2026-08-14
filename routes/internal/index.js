const express = require('express');
const router = express.Router();

router.use('/', require('./internalRoutes'));
router.use('/hdmstream', require('./hdmStreamRoutes'));

module.exports = router;