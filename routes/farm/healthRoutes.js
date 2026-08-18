const router = require('express').Router();
const { getRecords, getRecord, addRecord, updateRecord, deleteRecord, getUpcomingVaccinations, getOverdueVaccinations } = require('../../controllers/farm/healthController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canManageHealth } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/farm/:farmId', ownsFarm, getRecords);
router.get('/farm/:farmId/vaccinations/upcoming', ownsFarm, getUpcomingVaccinations);
router.get('/farm/:farmId/vaccinations/overdue', ownsFarm, getOverdueVaccinations);
router.get('/:id', getRecord);
router.post('/farm/:farmId', ownsFarm, canManageHealth, addRecord);
router.put('/:id', canManageHealth, updateRecord);
router.delete('/:id', canManageHealth, deleteRecord);

module.exports = router;