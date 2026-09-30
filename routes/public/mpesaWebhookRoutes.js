const router = require('express').Router();
const { mpesaCallback, mpesaTimeout } = require('../../controllers/webhook/mpesaController');

router.post('/mpesa-callback', mpesaCallback);
router.post('/mpesa-timeout', mpesaTimeout);

module.exports = router;