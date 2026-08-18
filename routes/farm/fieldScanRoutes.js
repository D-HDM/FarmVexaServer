const router = require('express').Router();
const {
    startFieldScan,
    analyzeFieldScan,
    getFieldScanSettings,
    getMyFieldScans,
    getFieldScanById,
    getFieldScansByField,
    deleteFieldScan,
} = require('../../controllers/farm/fieldScanController');
const farmerAuth = require('../../middleware/farm/auth');
const subscriptionCheck = require('../../middleware/farm/subscriptionCheck');
const { planCheck } = require('../../middleware/farm/planCheck');

router.use(farmerAuth);
router.use(subscriptionCheck);

router.post('/start', planCheck('field_scan'), startFieldScan);
router.post('/analyze', planCheck('field_scan'), analyzeFieldScan);
router.get('/settings', getFieldScanSettings);
router.get('/my-scans', getMyFieldScans);
router.get('/field/:fieldId', getFieldScansByField);
router.get('/:id', getFieldScanById);
router.delete('/:id', deleteFieldScan);

module.exports = router;