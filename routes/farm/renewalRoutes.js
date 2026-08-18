const router = require('express').Router();
const {
    getSubscriptionDetails,
    submitRenewal,
} = require('../../controllers/farm/renewalController');
const renewalAuth = require('../../middleware/farm/renewalAuth');

router.use(renewalAuth);

router.get('/subscription', getSubscriptionDetails);
router.post('/submit', submitRenewal);

module.exports = router;