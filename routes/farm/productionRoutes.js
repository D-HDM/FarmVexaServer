const router = require('express').Router();
const { getRecords, getRecord, addRecord, updateRecord, deleteRecord, getProductionSummary } = require('../../controllers/farm/productionController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { ownsFarm } = require('../../middleware/farm/farm');
const { canRecordProduction } = require('../../middleware/farm/farmRole');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.get('/farm/:farmId', ownsFarm, getRecords);
router.get('/farm/:farmId/summary', ownsFarm, getProductionSummary);
router.get('/:id', getRecord);
router.post('/farm/:farmId', ownsFarm, canRecordProduction, addRecord);
router.put('/:id', canRecordProduction, updateRecord);
router.delete('/:id', canRecordProduction, deleteRecord);

module.exports = router;