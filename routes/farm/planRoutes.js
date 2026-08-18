const router = require('express').Router();
const {
    getPlans,
    submitUpgrade,
} = require('../../controllers/farm/planController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/', getPlans);
router.post('/upgrade', submitUpgrade);

module.exports = router;