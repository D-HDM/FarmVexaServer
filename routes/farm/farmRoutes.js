const router = require('express').Router();
const { createFarm, getMyFarms, getFarmById, updateFarm, deleteFarm } = require('../../controllers/farm/farmController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { isFarmer } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/', getMyFarms);
router.get('/:id', getFarmById);
router.post('/', isFarmer, createFarm);
router.put('/:id', ownsFarm, isFarmer, updateFarm);
router.delete('/:id', ownsFarm, isFarmer, deleteFarm);

module.exports = router;