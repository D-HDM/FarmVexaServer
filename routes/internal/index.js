const express = require('express');
const router = express.Router();

router.use('/', require('./internalRoutes'));

module.exports = router;