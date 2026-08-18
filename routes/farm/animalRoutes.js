const router = require('express').Router();
const { getAnimals, getAnimal, addAnimal, updateAnimal, updateStatus, recordMortality, deleteAnimal } = require('../../controllers/farm/animalController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canManageLivestock } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/farm/:farmId', ownsFarm, getAnimals);
router.get('/:id', getAnimal);
router.post('/farm/:farmId', ownsFarm, canManageLivestock, addAnimal);
router.put('/:id', canManageLivestock, updateAnimal);
router.put('/:id/status', canManageLivestock, updateStatus);
router.put('/:id/mortality', canManageLivestock, recordMortality);
router.delete('/:id', canManageLivestock, deleteAnimal);

module.exports = router;