const router = require('express').Router();
const {
    getSubscriptionDetails,
    submitRenewal,
} = require('../../controllers/farm/renewalController');
const scopedAuth = require('../../middleware/farm/scopedAuth');

router.use(scopedAuth);

router.get('/subscription', getSubscriptionDetails);
router.post('/submit', submitRenewal);

module.exports = router;